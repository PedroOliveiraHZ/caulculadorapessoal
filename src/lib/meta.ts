import React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { create } from 'zustand';
import { supabase } from './supabase';
import { useTableStore } from '../store/tableStore';

/** Configuração da meta de economia (fica salva no navegador). */
export interface MetaConfig {
    nome: string;            // nome do objetivo
    valorMeta: number;       // valor total a juntar (R$)
    aporteMensal: number;    // quanto investir por mês (R$)
    saldoInicial: number;    // quanto já tinha guardado antes de usar o app (R$)
    rendimentoAnual: number; // rendimento líquido estimado ao ano (%)
    categoria: string;       // nome da categoria do orçamento que recebe os aportes
}

export const META_PADRAO: MetaConfig = {
    nome: 'Comprar meu apartamento',
    valorMeta: 50000,
    aporteMensal: 250,
    saldoInicial: 0,
    rendimentoAnual: 10,
    categoria: 'Apartamento',
};

const STORAGE_KEY = 'metaApartamento';

function carregar(): MetaConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...META_PADRAO, ...JSON.parse(raw) };
    } catch { /* ignora */ }
    return META_PADRAO;
}

interface MetaState {
    config: MetaConfig;
    setConfig: (c: MetaConfig) => void;
}

export const useMetaStore = create<MetaState>((set) => ({
    config: carregar(),
    setConfig: (c) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch { /* ignora */ }
        set({ config: c });
    },
}));

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Remove emojis, acentos e caixa para comparar nomes de categoria. */
export function normalizar(txt: string): string {
    return (txt || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\p{L}\p{N} ]/gu, '')
        .trim()
        .toLowerCase();
}

export function categoriaDaMeta(nomeCategoria: string, config: MetaConfig): boolean {
    const alvo = normalizar(config.categoria);
    return alvo.length > 0 && normalizar(nomeCategoria).includes(alvo);
}

const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Converte o nome do mês salvo no banco (em inglês) para português. */
export function mesPt(mesEn: string): string {
    const i = MESES_EN.indexOf(mesEn);
    return i >= 0 ? MESES_PT[i] : mesEn;
}

export interface Aporte {
    recordID: string;
    title: string;
    amount: number;          // positivo = aporte, negativo = resgate
    transactionDate: number;
}

/**
 * Busca todos os aportes (todas as transações de todos os meses) nas categorias
 * do orçamento atual cujo nome bate com a categoria da meta.
 */
export function useMetaProgresso() {
    const config = useMetaStore(s => s.config);
    const budgetID = useTableStore(s => s.currentBudgetAndMonth?.budgetID);
    const transacoesMes = useTableStore(s => s.transactions);
    const categoriasMes = useTableStore(s => s.categories);
    const [aportes, setAportes] = React.useState<Aporte[]>([]);
    const [carregando, setCarregando] = React.useState(false);
    const [versao, setVersao] = React.useState(0);

    const recarregar = React.useCallback(() => setVersao(v => v + 1), []);

    React.useEffect(() => {
        let cancelado = false;
        async function buscar() {
            if (!budgetID || budgetID === '1') { setAportes([]); return; }
            setCarregando(true);
            try {
                if (!navigator.onLine) throw new Error('offline');
                const comTimeout = <T,>(p: PromiseLike<T>) => Promise.race([
                    Promise.resolve(p),
                    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
                ]);
                const { data: secoes, error: e1 } = await comTimeout(supabase
                    .from('sections').select('recordID, sectionType').eq('budgetID', budgetID));
                if (e1) throw e1;
                const idsSecoes = (secoes || []).filter(s => s.sectionType !== 'income').map(s => s.recordID);
                if (idsSecoes.length === 0) { if (!cancelado) setAportes([]); return; }
                const { data: cats, error: e2 } = await comTimeout(supabase
                    .from('categories').select('recordID, categoryName').in('sectionID', idsSecoes));
                if (e2) throw e2;
                const idsCats = (cats || []).filter(c => categoriaDaMeta(c.categoryName, config)).map(c => c.recordID);
                if (idsCats.length === 0) { if (!cancelado) setAportes([]); return; }
                const { data: txs, error: e3 } = await comTimeout(supabase
                    .from('transactions').select('recordID, title, amount, transactionDate, transactionType').in('categoryID', idsCats));
                if (e3) throw e3;
                if (!cancelado) setAportes(mapear(txs || []));
            } catch {
                // Offline / erro: usa só o mês carregado em cache
                const ids = new Set(categoriasMes.filter((c: any) => categoriaDaMeta(c.categoryName, config)).map((c: any) => c.recordID));
                if (!cancelado) setAportes(mapear(transacoesMes.filter((t: any) => ids.has(t.categoryID))));
            } finally {
                if (!cancelado) setCarregando(false);
            }
        }
        buscar();
        return () => { cancelado = true; };
        // transacoesMes entra na dependência para atualizar quando um aporte é lançado
    }, [budgetID, config.categoria, versao, transacoesMes.length]);

    const totalAportado = aportes.reduce((a, t) => a + t.amount, 0);
    const guardado = config.saldoInicial + totalAportado;
    const falta = Math.max(0, config.valorMeta - guardado);
    const percentual = config.valorMeta > 0 ? Math.min(100, (guardado / config.valorMeta) * 100) : 0;

    const chaveMesAtual = dayjs().format('YYYY-MM');
    const porMes = new Map<string, number>();
    aportes.forEach(t => {
        const k = dayjs(t.transactionDate).format('YYYY-MM');
        porMes.set(k, (porMes.get(k) || 0) + t.amount);
    });
    const aportadoEsteMes = porMes.get(chaveMesAtual) || 0;

    // Sequência de meses seguidos batendo o aporte (conta o mês atual só se já bateu)
    let sequencia = 0;
    let cursor = dayjs().startOf('month');
    if ((porMes.get(cursor.format('YYYY-MM')) || 0) < config.aporteMensal) cursor = cursor.subtract(1, 'month');
    while ((porMes.get(cursor.format('YYYY-MM')) || 0) >= config.aporteMensal && config.aporteMensal > 0) {
        sequencia++;
        cursor = cursor.subtract(1, 'month');
    }

    const projecao = projetar(guardado, config);

    return {
        config, aportes, carregando, recarregar,
        totalAportado, guardado, falta, percentual,
        porMes, aportadoEsteMes, sequencia, projecao,
    };
}

function mapear(txs: any[]): Aporte[] {
    return txs
        .map(t => ({
            recordID: t.recordID,
            title: t.title,
            amount: t.transactionType === 'income' ? -Number(t.amount) : Number(t.amount),
            transactionDate: Number(t.transactionDate),
        }))
        .sort((a, b) => b.transactionDate - a.transactionDate);
}

export interface PontoProjecao { mes: string; comRendimento: number; semRendimento: number; }

/** Simula mês a mês até atingir a meta (máx. 50 anos). */
export function projetar(guardado: number, config: MetaConfig) {
    const taxaMensal = Math.pow(1 + (config.rendimentoAnual || 0) / 100, 1 / 12) - 1;
    const pontos: PontoProjecao[] = [];
    let comR = guardado, semR = guardado;
    let mesesComRendimento: number | null = comR >= config.valorMeta ? 0 : null;
    let mesesSemRendimento: number | null = semR >= config.valorMeta ? 0 : null;
    const inicio = dayjs().startOf('month');
    pontos.push({ mes: inicio.locale('pt-br').format('MMM/YY'), comRendimento: round(comR), semRendimento: round(semR) });
    for (let m = 1; m <= 600; m++) {
        comR = comR * (1 + taxaMensal) + config.aporteMensal;
        semR = semR + config.aporteMensal;
        if (mesesComRendimento === null && comR >= config.valorMeta) mesesComRendimento = m;
        if (mesesSemRendimento === null && semR >= config.valorMeta) mesesSemRendimento = m;
        pontos.push({ mes: inicio.add(m, 'month').locale('pt-br').format('MMM/YY'), comRendimento: round(comR), semRendimento: round(semR) });
        if (mesesComRendimento !== null && m >= mesesComRendimento) break;
    }
    // sem rendimento: cálculo direto (o laço acima para quando a versão com rendimento chega na meta)
    if (mesesSemRendimento === null && config.aporteMensal > 0) {
        const n = Math.ceil((config.valorMeta - guardado) / config.aporteMensal);
        mesesSemRendimento = n <= 600 ? n : null;
    }
    // reduz pontos para o gráfico ficar leve
    const passo = Math.max(1, Math.ceil(pontos.length / 60));
    const grafico = pontos.filter((_, i) => i % passo === 0 || i === pontos.length - 1);
    return {
        mesesComRendimento,
        mesesSemRendimento,
        dataComRendimento: mesesComRendimento !== null ? inicio.add(mesesComRendimento, 'month') : null,
        dataSemRendimento: mesesSemRendimento !== null ? inicio.add(mesesSemRendimento, 'month') : null,
        rendimentoEstimado: round(comR - semR),
        grafico,
    };
}

function round(n: number) { return Math.round(n * 100) / 100; }

export function duracaoPt(meses: number | null): string {
    if (meses === null) return 'mais de 50 anos';
    if (meses === 0) return 'meta atingida!';
    const anos = Math.floor(meses / 12);
    const resto = meses % 12;
    const partes: string[] = [];
    if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
    if (resto > 0) partes.push(`${resto} ${resto === 1 ? 'mês' : 'meses'}`);
    return partes.join(' e ');
}
