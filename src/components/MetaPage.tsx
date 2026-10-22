import React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import ApartmentIcon from '@mui/icons-material/Apartment';
import TuneIcon from '@mui/icons-material/Tune';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CloseIcon from '@mui/icons-material/Close';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { insertTransactionWithOfflineSupport } from '../lib/offlineSync';
import { useTableStore } from '../store/tableStore';
import { dialogPaperStyles, useGlobalStore } from '../store/globalStore';
import {
    brl, categoriaDaMeta, duracaoPt, mesPt, MetaConfig, META_PADRAO, useMetaProgresso, useMetaStore,
} from '../lib/meta';

const MARCOS = [25, 50, 75, 100];

export default function MetaPage() {
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));
    const {
        config, aportes, carregando, recarregar, guardado, falta, percentual,
        porMes, aportadoEsteMes, sequencia, projecao, totalAportado,
    } = useMetaProgresso();
    const setConfig = useMetaStore(s => s.setConfig);
    const currentBudget = useTableStore(s => s.currentBudgetAndMonth);
    const sections = useTableStore(s => s.sections);
    const categories = useTableStore(s => s.categories);
    const setSections = useTableStore(s => s.setSections);
    const setCategories = useTableStore(s => s.setCategories);
    const setTransactions = useTableStore(s => s.setTransactions);
    const currentUser = useGlobalStore(s => s.currentUser);
    const setLoading = useGlobalStore(s => s.setMainLoading);
    const setSnackText = useGlobalStore(s => s.setSnackBarText);
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);

    const [editando, setEditando] = React.useState(false);
    const [rascunho, setRascunho] = React.useState<MetaConfig>(config);
    const [aporteOpen, setAporteOpen] = React.useState(false);
    const [valorAporte, setValorAporte] = React.useState<string>(String(config.aporteMensal));
    const [erro, setErro] = React.useState('');

    const textColor = theme.palette.text.secondary;
    const categoriaMes = categories.find((c: any) => {
        const sec = sections.find((s: any) => s.recordID === c.sectionID);
        return sec && sec.sectionType !== 'income' && categoriaDaMeta(c.categoryName, config);
    });
    const temOrcamento = currentBudget?.budgetID && currentBudget.budgetID !== '1';
    const bateuMes = aportadoEsteMes >= config.aporteMensal;
    const faltaMes = Math.max(0, config.aporteMensal - aportadoEsteMes);

    function avisar(msg: string, sev: 'success' | 'error' | 'info' = 'success') {
        setSnackSev(sev); setSnackText(msg); setSnackOpen(true);
    }

    async function criarCategoria() {
        if (!temOrcamento) return;
        setLoading(true);
        try {
            let secao = sections.find((s: any) => s.sectionType !== 'income' && /invest|econom|poupan|reserva/i.test(s.sectionName));
            if (!secao) {
                secao = {
                    recordID: uuidv4(),
                    budgetID: currentBudget.budgetID,
                    sectionName: 'Investimentos',
                    sectionType: 'expense',
                    sectionYear: currentBudget.year,
                    sectionMonth: currentBudget.month,
                };
                const { error } = await supabase.from('sections').insert(secao);
                if (error) throw error;
                setSections((prev: any[]) => [...prev, secao]);
            }
            const cat = {
                recordID: uuidv4(),
                sectionID: secao.recordID,
                categoryName: `🏢 ${config.categoria}`,
                amount: config.aporteMensal,
            };
            const { error } = await supabase.from('categories').insert(cat);
            if (error) throw error;
            setCategories((prev: any[]) => [...prev, cat]);
            avisar(`Categoria "${config.categoria}" criada neste mês!`);
        } catch (e: any) {
            avisar(e.message || 'Não foi possível criar a categoria', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function registrarAporte() {
        setErro('');
        const valor = Math.round(Number(String(valorAporte).replace(',', '.')) * 100) / 100;
        if (!valor || valor <= 0) { setErro('Informe um valor maior que zero'); return; }
        if (!categoriaMes) { setErro('Crie a categoria da meta neste mês primeiro'); return; }
        const tx = {
            recordID: uuidv4(),
            budgetID: currentBudget.budgetID,
            categoryID: categoriaMes.recordID,
            amount: valor,
            title: `Aporte - ${config.categoria}`,
            transactionDate: dayjs().valueOf(),
            transactionType: 'expense',
            creatorID: currentUser.recordID,
        };
        setLoading(true);
        try {
            if (navigator.onLine) {
                const { error } = await supabase.from('transactions').insert(tx);
                if (error) throw error;
            } else {
                const r = await insertTransactionWithOfflineSupport(tx as any);
                if (!r.success) throw new Error(r.error || 'Falha ao salvar');
            }
            setTransactions((prev: any[]) => [...prev, tx]);
            setAporteOpen(false);
            recarregar();
            avisar(`Aporte de ${brl.format(valor)} registrado! 🚀`);
        } catch (e: any) {
            setErro(e.message || 'Falha ao registrar o aporte');
        } finally {
            setLoading(false);
        }
    }

    function salvarConfig() {
        const num = (v: any) => Number(String(v).replace(',', '.')) || 0;
        const nova: MetaConfig = {
            nome: rascunho.nome.trim() || META_PADRAO.nome,
            categoria: rascunho.categoria.trim() || META_PADRAO.categoria,
            valorMeta: num(rascunho.valorMeta),
            aporteMensal: num(rascunho.aporteMensal),
            saldoInicial: num(rascunho.saldoInicial),
            rendimentoAnual: num(rascunho.rendimentoAnual),
        };
        setConfig(nova);
        setEditando(false);
        avisar('Meta atualizada!');
    }

    // Últimos 12 meses para o histórico
    const historico = Array.from({ length: 12 }, (_, i) => {
        const d = dayjs().startOf('month').subtract(i, 'month');
        const v = porMes.get(d.format('YYYY-MM')) || 0;
        return { label: `${mesPt(d.locale('en').format('MMMM'))}/${d.format('YY')}`, valor: v };
    });

    const corBarra = percentual >= 100 ? 'success' : 'primary';

    return (
        <Box display='flex' justifyContent='center'>
            <Stack spacing={2} sx={{ width: '100%', maxWidth: 900 }}>

                {/* Cabeçalho + barra principal */}
                <Paper elevation={4} sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
                    <Box display='flex' alignItems='center' gap={1.5} mb={2}>
                        <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2, p: 1, display: 'flex' }}>
                            <ApartmentIcon />
                        </Box>
                        <Box flexGrow={1} minWidth={0}>
                            <Typography variant='overline' color='text.secondary' lineHeight={1}>Minha meta</Typography>
                            <Typography variant='h6' fontWeight={700} noWrap>{config.nome}</Typography>
                        </Box>
                        <IconButton aria-label='Editar meta' onClick={() => { setRascunho(config); setEditando(true); }}>
                            <TuneIcon />
                        </IconButton>
                    </Box>

                    <Box display='flex' justifyContent='space-between' alignItems='baseline' flexWrap='wrap' gap={1}>
                        <Typography variant='h4' fontWeight={800}>{brl.format(guardado)}</Typography>
                        <Typography color='text.secondary'>de {brl.format(config.valorMeta)}</Typography>
                    </Box>

                    <Box sx={{ position: 'relative', mt: 1.5, mb: 3 }}>
                        <LinearProgress
                            variant={carregando ? 'indeterminate' : 'determinate'}
                            value={percentual}
                            color={corBarra}
                            sx={{ height: 18, borderRadius: 9, '& .MuiLinearProgress-bar': { borderRadius: 9 } }}
                        />
                        {MARCOS.slice(0, 3).map(m => (
                            <Box key={m} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${m}%`, width: 2, bgcolor: 'background.paper', opacity: 0.6 }} />
                        ))}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography variant='caption' color='text.secondary'>0%</Typography>
                            <Typography variant='caption' fontWeight={700}>{percentual.toFixed(1)}% concluído</Typography>
                            <Typography variant='caption' color='text.secondary'>100%</Typography>
                        </Box>
                    </Box>

                    <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                        {MARCOS.map(m => (
                            <Chip key={m} size='small' label={`${m}%`}
                                color={percentual >= m ? 'success' : 'default'}
                                variant={percentual >= m ? 'filled' : 'outlined'}
                                icon={percentual >= m ? <CheckCircleIcon /> : undefined} />
                        ))}
                        {sequencia > 0 && (
                            <Chip size='small' color='warning' icon={<LocalFireDepartmentIcon />}
                                label={`${sequencia} ${sequencia === 1 ? 'mês seguido' : 'meses seguidos'}`} />
                        )}
                    </Stack>
                </Paper>

                {!temOrcamento && (
                    <Alert severity='info'>Crie ou selecione um orçamento para começar a registrar seus aportes.</Alert>
                )}

                <Grid container spacing={2}>
                    {/* Aporte do mês */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper elevation={4} sx={{ borderRadius: 3, p: 2, height: '100%' }}>
                            <Typography variant='subtitle2' color='text.secondary'>
                                Aporte de {mesPt(dayjs().locale('en').format('MMMM'))}
                            </Typography>
                            <Box display='flex' alignItems='baseline' gap={1} mt={0.5}>
                                <Typography variant='h5' fontWeight={700}>{brl.format(aportadoEsteMes)}</Typography>
                                <Typography color='text.secondary'>/ {brl.format(config.aporteMensal)}</Typography>
                            </Box>
                            <LinearProgress
                                variant='determinate'
                                value={config.aporteMensal > 0 ? Math.min(100, (aportadoEsteMes / config.aporteMensal) * 100) : 0}
                                color={bateuMes ? 'success' : 'secondary'}
                                sx={{ height: 8, borderRadius: 4, my: 1.5 }}
                            />
                            <Typography variant='body2' color={bateuMes ? 'success.main' : 'text.secondary'} mb={2}>
                                {bateuMes ? '✅ Aporte do mês feito. Continue assim!' : `Faltam ${brl.format(faltaMes)} para bater o aporte deste mês.`}
                            </Typography>
                            {temOrcamento && !categoriaMes ? (
                                <>
                                    <Typography variant='body2' color='text.secondary' mb={1}>
                                        O mês selecionado ({mesPt(currentBudget.month)}) ainda não tem a categoria "{config.categoria}".
                                    </Typography>
                                    <Button fullWidth variant='outlined' startIcon={<AddIcon />} onClick={criarCategoria}>
                                        Criar categoria "{config.categoria}"
                                    </Button>
                                </>
                            ) : (
                                <Button fullWidth variant='contained' startIcon={<AddIcon />} disabled={!temOrcamento}
                                    onClick={() => { setValorAporte(String(faltaMes > 0 ? faltaMes : config.aporteMensal)); setErro(''); setAporteOpen(true); }}>
                                    Registrar aporte
                                </Button>
                            )}
                        </Paper>
                    </Grid>

                    {/* Previsão */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper elevation={4} sx={{ borderRadius: 3, p: 2, height: '100%' }}>
                            <Typography variant='subtitle2' color='text.secondary'>Previsão para atingir a meta</Typography>
                            <Typography variant='h5' fontWeight={700} mt={0.5}>
                                {projecao.dataComRendimento ? `${mesPt(projecao.dataComRendimento.locale('en').format('MMMM'))} de ${projecao.dataComRendimento.year()}` : '—'}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                                em {duracaoPt(projecao.mesesComRendimento)} investindo {brl.format(config.aporteMensal)}/mês a {config.rendimentoAnual}% a.a.
                            </Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack spacing={0.5}>
                                <Linha rotulo='Falta juntar' valor={brl.format(falta)} />
                                <Linha rotulo='Total aportado no app' valor={brl.format(totalAportado)} />
                                <Linha rotulo='Saldo inicial' valor={brl.format(config.saldoInicial)} />
                                <Linha rotulo='Sem rendimento levaria' valor={duracaoPt(projecao.mesesSemRendimento)} />
                                <Linha rotulo='Juros estimados até a meta' valor={brl.format(Math.max(0, projecao.rendimentoEstimado))} />
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* Gráfico de projeção */}
                    {projecao.grafico.length > 1 && (
                        <Grid size={12}>
                            <Paper elevation={4} sx={{ borderRadius: 3, p: 2 }}>
                                <Typography textAlign='center' color='text.secondary' variant='h6' sx={{ fontWeight: 600, mb: 1 }}>
                                    Projeção do patrimônio
                                </Typography>
                                <ResponsiveContainer width='100%' height={bigger ? 300 : 240}>
                                    <AreaChart data={projecao.grafico} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id='gradMeta' x1='0' y1='0' x2='0' y2='1'>
                                                <stop offset='5%' stopColor={theme.palette.primary.main} stopOpacity={0.5} />
                                                <stop offset='95%' stopColor={theme.palette.primary.main} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray='3 3' stroke={theme.palette.divider} />
                                        <XAxis dataKey='mes' tick={{ fill: textColor, fontSize: 11 }} minTickGap={20} />
                                        <YAxis tick={{ fill: textColor, fontSize: 11 }} width={60}
                                            tickFormatter={(v) => v >= 1000 ? `R$${Math.round(v / 1000)}k` : `R$${v}`} />
                                        <Tooltip formatter={(v) => brl.format(Number(v))}
                                            contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }} />
                                        <Legend />
                                        <ReferenceLine y={config.valorMeta} stroke={theme.palette.success.main} strokeDasharray='6 4'
                                            label={{ value: 'Meta', fill: theme.palette.success.main, fontSize: 12, position: 'insideTopLeft' }} />
                                        <Area type='monotone' dataKey='comRendimento' name='Com rendimento' stroke={theme.palette.primary.main} fill='url(#gradMeta)' strokeWidth={2} />
                                        <Area type='monotone' dataKey='semRendimento' name='Só aportes' stroke={theme.palette.secondary.main} fill='transparent' strokeDasharray='4 3' strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>
                    )}

                    {/* Histórico mensal */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper elevation={4} sx={{ borderRadius: 3, p: 2 }}>
                            <Typography variant='subtitle1' fontWeight={600} mb={1}>Últimos 12 meses</Typography>
                            <Stack spacing={0.75}>
                                {historico.map(h => (
                                    <Box key={h.label} display='flex' alignItems='center' gap={1}>
                                        <Typography variant='body2' sx={{ width: 110, textTransform: 'capitalize' }}>{h.label}</Typography>
                                        <LinearProgress variant='determinate'
                                            value={config.aporteMensal > 0 ? Math.min(100, (h.valor / config.aporteMensal) * 100) : 0}
                                            color={h.valor >= config.aporteMensal ? 'success' : 'secondary'}
                                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }} />
                                        <Typography variant='body2' sx={{ width: 96, textAlign: 'right' }}>{brl.format(h.valor)}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* Lista de aportes */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper elevation={4} sx={{ borderRadius: 3, p: 2 }}>
                            <Typography variant='subtitle1' fontWeight={600} mb={1}>Aportes registrados</Typography>
                            {aportes.length === 0 ? (
                                <Typography variant='body2' color='text.secondary'>
                                    Nenhum aporte ainda. Use "Registrar aporte" ou lance uma transação de despesa na categoria "{config.categoria}".
                                </Typography>
                            ) : (
                                <Stack divider={<Divider flexItem />} spacing={0.75} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                                    {aportes.slice(0, 50).map(a => (
                                        <Box key={a.recordID} display='flex' justifyContent='space-between' gap={1}>
                                            <Box minWidth={0}>
                                                <Typography variant='body2' noWrap>{a.title}</Typography>
                                                <Typography variant='caption' color='text.secondary'>{dayjs(a.transactionDate).format('DD/MM/YYYY')}</Typography>
                                            </Box>
                                            <Typography variant='body2' fontWeight={600} color={a.amount >= 0 ? 'success.main' : 'error.main'}>
                                                {a.amount >= 0 ? '+' : '−'}{brl.format(Math.abs(a.amount))}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                <Typography variant='caption' color='text.secondary' textAlign='center' sx={{ px: 2 }}>
                    Os aportes são as transações de despesa lançadas em qualquer categoria chamada "{config.categoria}" (em todos os meses deste orçamento).
                    Lançamentos de receita nessa categoria contam como resgate. A previsão é uma estimativa e não considera inflação nem variação do preço do imóvel.
                </Typography>
            </Stack>

            {/* Dialog: registrar aporte */}
            <Dialog open={aporteOpen} onClose={() => setAporteOpen(false)} slotProps={{ paper: bigger ? dialogPaperStyles : undefined }} fullWidth maxWidth='xs'>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Registrar aporte<IconButton onClick={() => setAporteOpen(false)}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <TextField autoFocus fullWidth label='Valor' type='number' value={valorAporte}
                        onChange={(e) => setValorAporte(e.target.value)}
                        slotProps={{ input: { startAdornment: <InputAdornment position='start'>R$</InputAdornment> }, htmlInput: { step: '0.01', min: 0 } }} />
                    <Typography variant='caption' color='text.secondary' display='block' mt={1}>
                        Será lançado hoje na categoria "{categoriaMes?.categoryName}" de {mesPt(currentBudget?.month)}.
                    </Typography>
                    {erro && <Typography color='error' mt={1}>{erro}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button fullWidth variant='contained' startIcon={<AddIcon />} onClick={registrarAporte}>Confirmar aporte</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog: editar meta */}
            <Dialog open={editando} onClose={() => setEditando(false)} fullScreen={!bigger} slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Configurar meta<IconButton onClick={() => setEditando(false)}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        <Grid size={12}>
                            <TextField fullWidth label='Objetivo' value={rascunho.nome}
                                onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <CampoValor label='Valor da meta' value={rascunho.valorMeta}
                                onChange={(v) => setRascunho({ ...rascunho, valorMeta: v as any })}
                                helper='Ex.: valor da entrada do apartamento' />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <CampoValor label='Aporte mensal' value={rascunho.aporteMensal}
                                onChange={(v) => setRascunho({ ...rascunho, aporteMensal: v as any })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <CampoValor label='Já guardado (fora do app)' value={rascunho.saldoInicial}
                                onChange={(v) => setRascunho({ ...rascunho, saldoInicial: v as any })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField fullWidth label='Rendimento líquido ao ano' type='number' value={rascunho.rendimentoAnual}
                                onChange={(e) => setRascunho({ ...rascunho, rendimentoAnual: e.target.value as any })}
                                helperText='Ex.: CDB/Tesouro já descontado o IR'
                                slotProps={{ input: { endAdornment: <InputAdornment position='end'>%</InputAdornment> }, htmlInput: { step: '0.1' } }} />
                        </Grid>
                        <Grid size={12}>
                            <TextField fullWidth label='Categoria dos aportes' value={rascunho.categoria}
                                onChange={(e) => setRascunho({ ...rascunho, categoria: e.target.value })}
                                helperText='Transações lançadas em categorias com este nome contam para a meta' />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRascunho(META_PADRAO)}>Restaurar padrão</Button>
                    <Button variant='contained' onClick={salvarConfig}>Salvar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
    return (
        <Box display='flex' justifyContent='space-between' gap={1}>
            <Typography variant='body2' color='text.secondary'>{rotulo}</Typography>
            <Typography variant='body2' fontWeight={600} textAlign='right'>{valor}</Typography>
        </Box>
    );
}

function CampoValor({ label, value, onChange, helper }: { label: string; value: any; onChange: (v: string) => void; helper?: string }) {
    return (
        <TextField fullWidth label={label} type='number' value={value} helperText={helper}
            onChange={(e) => onChange(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position='start'>R$</InputAdornment> }, htmlInput: { step: '0.01', min: 0 } }} />
    );
}
