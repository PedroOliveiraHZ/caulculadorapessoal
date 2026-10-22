import { useGlobalStore } from "../../store/globalStore";
import { useModalStore } from "../../store/modalStore";
import { useTableStore } from "../../store/tableStore";
import { supabase } from "../../lib/supabase";
import { ensureSession } from "./ensureSession";
import { withNetworkTimeout } from "../../lib/networkUtils";
import GlobalJS from "./GlobalJS";

const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

export default function useCategoryActions() {
    const categoryArray = useTableStore(s => s.categories);
    const setCategoryArray = useTableStore(s => s.setCategories);
    const transactionsArray = useTableStore(s => s.transactions);
    const setTransactionsArray = useTableStore(s => s.setTransactions);
    const sectionsArray = useTableStore(s => s.sections);
    const currentCategoryID = useModalStore(s => s.currentCategory);
    const currentSectionID = useModalStore(s => s.currentSection);
    const setLoadingOpen = useGlobalStore(s => s.setMainLoading);
    const setSnackText = useGlobalStore(s => s.setSnackBarText);
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);
    const setAreYouSureOpen = useModalStore(s => s.setAreYouSure);
    const setCheckTitle = useGlobalStore(s => s.setAreYouSureTitle);
    const setCheckDetails = useGlobalStore(s => s.setAreYouSureDetails);
    const { grabCategorySum } = GlobalJS();

    const currentCategory = categoryArray.find(c => c.recordID === currentCategoryID);
    const currentSection = sectionsArray.find(s => s.recordID === currentSectionID);
    const currentSectionType = currentSection?.sectionType;

    // --- Preview values so the UI can explain what each action will do ---

    // Balance: planned amount becomes the absolute tracked total for this category.
    const balanceTarget = Math.round(Math.abs(grabCategorySum(currentCategoryID)) * 100) / 100;

    // Allocate: planned amount becomes the leftover unbudgeted income.
    const allocateTarget = (() => {
        const totalIncome = categoryArray
            .filter(c => sectionsArray.find(s => s.recordID === c.sectionID)?.sectionType === 'income')
            .reduce((acc, c) => acc + Number(c.amount), 0);
        let remaining: number;
        if (currentSectionType === 'income') {
            const otherIncome = categoryArray
                .filter(c => sectionsArray.find(s => s.recordID === c.sectionID)?.sectionType === 'income')
                .filter(c => c.recordID !== currentCategoryID)
                .reduce((acc, c) => acc + Number(c.amount), 0);
            remaining = totalIncome - otherIncome;
        } else {
            const totalExpense = categoryArray
                .filter(c => sectionsArray.find(s => s.recordID === c.sectionID)?.sectionType === 'expense')
                .filter(c => c.recordID !== currentCategoryID)
                .reduce((acc, c) => acc + Number(c.amount), 0);
            remaining = totalIncome - totalExpense;
        }
        return Math.round(Math.max(remaining, 0) * 100) / 100;
    })();

    async function balanceCategory(): Promise<string | null> {
        const categorySum = grabCategorySum(currentCategoryID);
        setLoadingOpen(true);
        try {
            await withNetworkTimeout(ensureSession());
            const { error } = await withNetworkTimeout(
                Promise.resolve(supabase.from('categories').update({ amount: Math.abs(categorySum) }).eq('recordID', currentCategoryID))
            ) as { error: any };
            if (error) {
                setLoadingOpen(false);
                return error.message;
            }
            setCategoryArray(categoryArray.map(obj =>
                obj.recordID === currentCategoryID
                    ? { ...obj, amount: Number(Math.abs(categorySum)) }
                    : obj
            ));
            setLoadingOpen(false);
            setSnackSev('success');
            setSnackText('Categoria equilibrada!');
            setSnackOpen(true);
            return null;
        } catch (err: any) {
            setLoadingOpen(false);
            return err.message || 'Erro de rede — tente novamente quando estiver online';
        }
    }

    async function allocateRestOfBudget(): Promise<string | null> {
        const remaining = allocateTarget;

        setLoadingOpen(true);
        try {
            await withNetworkTimeout(ensureSession());
            const { error } = await withNetworkTimeout(
                Promise.resolve(supabase.from('categories').update({ amount: remaining }).eq('recordID', currentCategoryID))
            ) as { error: any };
            if (error) {
                setLoadingOpen(false);
                return error.message;
            }
            setCategoryArray(categoryArray.map(obj =>
                obj.recordID === currentCategoryID
                    ? { ...obj, amount: remaining }
                    : obj
            ));
            setLoadingOpen(false);
            setSnackSev('success');
            setSnackText('Alocado ' + formatter.format(remaining) + ' nesta categoria');
            setSnackOpen(true);
            return null;
        } catch (err: any) {
            setLoadingOpen(false);
            return err.message || 'Erro de rede — tente novamente quando estiver online';
        }
    }

    function promptDeleteCategory() {
        setCheckTitle('Tem certeza que deseja excluir esta categoria?');
        setCheckDetails('ATENÇÃO: todas as transações desta categoria também serão excluídas.');
        setAreYouSureOpen(true);
    }

    async function deleteCategory(): Promise<string | null> {
        setLoadingOpen(true);
        try {
            await withNetworkTimeout(ensureSession());
            await withNetworkTimeout(
                Promise.resolve(supabase.from('transactions').delete().eq('categoryID', currentCategoryID))
            );
            const { error } = await withNetworkTimeout(
                Promise.resolve(supabase.from('categories').delete().eq('recordID', currentCategoryID))
            ) as { error: any };
            if (error) {
                setLoadingOpen(false);
                return error.message;
            }
            setCategoryArray(categoryArray.filter(el => el.recordID !== currentCategoryID));
            setTransactionsArray(transactionsArray.filter(el => el.categoryID !== currentCategoryID));
            setLoadingOpen(false);
            setSnackSev('success');
            setSnackText('Categoria excluída');
            setSnackOpen(true);
            return null;
        } catch (err: any) {
            setLoadingOpen(false);
            return err.message || 'Erro de rede — tente novamente quando estiver online';
        }
    }

    async function updateCategory(name: string, amount: number, categoryNote?: string): Promise<string | null> {
        setLoadingOpen(true);
        try {
            await withNetworkTimeout(ensureSession());
            const updatePayload: any = {
                categoryName: name,
                amount: amount === null || (amount as any) === '' ? 0 : amount,
            };
            if (categoryNote !== undefined) {
                updatePayload.categoryNote = categoryNote;
            }
            const { error } = await withNetworkTimeout(
                Promise.resolve(supabase.from('categories').update(updatePayload).eq('recordID', currentCategoryID))
            ) as { error: any };
            if (error) {
                setLoadingOpen(false);
                return error.message;
            }
            setCategoryArray(categoryArray.map(obj =>
                obj.recordID === currentCategoryID
                    ? { ...obj, categoryName: name, amount: Number(amount), ...(categoryNote !== undefined && { categoryNote }) }
                    : obj
            ));
            setLoadingOpen(false);
            setSnackSev('success');
            setSnackText('Categoria atualizada!');
            setSnackOpen(true);
            return null;
        } catch (err: any) {
            setLoadingOpen(false);
            return err.message || 'Erro de rede — tente novamente quando estiver online';
        }
    }

    return {
        balanceCategory,
        allocateRestOfBudget,
        promptDeleteCategory,
        deleteCategory,
        updateCategory,
        currentCategory,
        currentSection,
        currentSectionType,
        balanceTarget,
        allocateTarget,
    };
}
