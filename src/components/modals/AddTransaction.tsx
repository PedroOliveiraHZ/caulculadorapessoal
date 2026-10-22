import { mesPt } from '../../lib/meta';
import React from 'react';
import TextField from "@mui/material/TextField";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useModalStore } from '../../store/modalStore';
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { dialogPaperStyles, useGlobalStore } from "../../store/globalStore";
import { v4 as uuidv4 } from "uuid";
import dayjs, { Dayjs } from "dayjs";
import { useTableStore } from "../../store/tableStore";
import TransactionFields from "../subcomponents/TransactionFields";
import { useCategoryGroups } from "../extras/useCategoryGroups";
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from "@mui/material/ToggleButton";
import InputAdornment from "@mui/material/InputAdornment";
import AddIcon from "@mui/icons-material/Add";
import { insertTransactionWithOfflineSupport } from "../../lib/offlineSync";
import CloseIcon from '@mui/icons-material/Close';
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { styled, lighten, darken, alpha } from '@mui/system';
import Alert from '@mui/material/Alert';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import ReadMoreOutlinedIcon from '@mui/icons-material/ReadMoreOutlined';

const GroupHeader = styled('div')(({ theme }) => ({
    position: 'sticky',
    top: '-8px',
    padding: '4px 10px',
    color: theme.palette.primary.main,
    backgroundColor:
        theme.palette.mode === 'light'
            ? lighten(theme.palette.primary.light, 0.85)
            : darken(theme.palette.primary.main, 0.8),
}));

const GroupItems = styled('ul')({
    padding: 0,
});

const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

export default function AddTransaction() {
    const setLoadingOpen = useGlobalStore(s => s.setMainLoading)
    const [splitBool, setSplitBool] = React.useState(false);
    const addNewTransaction = useModalStore(s => s.addTransaction);
    const setAddNewTransaction = useModalStore(s => s.setAddTransaction);
    const [transactionAmount, setTransactionAmount] = React.useState(0.00)
    const [transactionTitle, setTransactionTitle] = React.useState('')
    const transactionCategory = useGlobalStore(s => s.addTransactionCategory);
    const setTransactionCategory = useGlobalStore(s => s.setAddTransactionCategory);
    const transactionType = useGlobalStore(s => s.addTransactionType);
    const setTransactionType = useGlobalStore(s => s.setAddTransactionType);

    let splitArrDef = [
        {
            recId: uuidv4(),
            cat: transactionCategory,
            transAmount: transactionAmount,
        }
    ]
    const [splitArr, setSplitArr] = React.useState(splitArrDef);
    const [transactionDate, setTransactionDate] = React.useState<Dayjs | null>(dayjs())
    const categoryGroups = useCategoryGroups();
    const setTransactionsArray = useTableStore(s => s.setTransactions)
    const setSnackText = useGlobalStore(s => s.setSnackBarText);
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);
    const currentBudget = useTableStore(s => s.currentBudgetAndMonth)
    const currentUserData = useGlobalStore(s => s.currentUser)
    const [errorText, setErrorText] = React.useState('')
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));
    const verifyInputs = () => {
        if (transactionTitle === '' || transactionTitle === null) {
            setErrorText('Informe um título')
            return false
        }
        if (transactionDate === null) {
            setErrorText('Informe uma data')
            return false
        }
        return true
    }
    async function handleSubmit(event: any) {
        event.preventDefault();
        if (currentBudget.budgetID === undefined) {
            setErrorText('Crie um orçamento primeiro! Vá em Ajustes e clique em \'Trocar Orçamento\'')
            return
        }
        setErrorText('')
        if (!verifyInputs()) {
            return
        }
        setLoadingOpen(true)
        // Session refresh happens in the background sync — no need to block here
        if (splitBool) {
            const splitTotal = splitArr.reduce((acc, obj) => acc + Number(obj.transAmount), 0);
            if (Math.abs(Number(transactionAmount) - splitTotal) > 0.01) {
                setErrorText('É preciso distribuir o valor total!')
                setLoadingOpen(false)
                return
            }

            // Validate all splits have a category selected
            if (splitArr.some(row => row.cat === null || row.cat === undefined)) {
                setErrorText('Selecione uma categoria para cada divisão')
                setLoadingOpen(false)
                return
            }

            let addTransactions = splitArr.map((row) => {
                return {
                    recordID: row.recId,
                    budgetID: currentBudget.budgetID,
                    categoryID: row.cat.id,
                    amount: Math.round(Number(row.transAmount) * 100) / 100,
                    title: transactionTitle + ' ' + transactionAmount + ' split',
                    transactionDate: dayjs(transactionDate).valueOf() !== null ? dayjs(transactionDate).valueOf() : dayjs().valueOf(),
                    transactionType: transactionType,
                    creatorID: currentUserData.recordID,
                }
            })

            try {
                for (const x of addTransactions) {
                    const result = await insertTransactionWithOfflineSupport(x);
                    if (!result.success) {
                        setErrorText(result.error || 'Falha ao salvar a transação')
                        setLoadingOpen(false)
                        return
                    }
                    setTransactionsArray((prevState: any[]) => [...prevState, x]);
                }
                setAddNewTransaction(false)
                setLoadingOpen(false)
                setSnackSev('success')
                setSnackText(navigator.onLine ? 'Transações adicionadas!' : 'Transações salvas offline — serão sincronizadas quando estiver online!')
                setSnackOpen(true)
            } catch (err: any) {
                setErrorText(err.message || 'Falha ao salvar as transações divididas')
                setLoadingOpen(false)
                return
            }
            return
        } //the typical un-split transaction
        let newTransaction = {
            recordID: uuidv4(),
            budgetID: currentBudget.budgetID,
            //@ts-ignore
            categoryID: transactionCategory === null ? null : transactionCategory.id,
            //@ts-ignore
            amount: transactionAmount === '' ? 0 : Math.round(transactionAmount * 100) / 100,
            title: transactionTitle,
            transactionDate: dayjs(transactionDate).valueOf() !== null ? dayjs(transactionDate).valueOf() : dayjs().valueOf(),
            transactionType: transactionType,
            creatorID: currentUserData.recordID,
        };
        const result = await insertTransactionWithOfflineSupport(newTransaction);
        if (!result.success) {
            setErrorText(result.error || 'Falha ao salvar a transação')
            setLoadingOpen(false)
            return
        }
        //@ts-ignore
        setTransactionsArray(prevState => [...prevState, newTransaction]);
        setAddNewTransaction(false)
        setLoadingOpen(false)
        setSnackSev('success')
        setSnackText(navigator.onLine ? 'Transação adicionada!' : 'Transação salva offline — será sincronizada quando estiver online!')
        setSnackOpen(true)
    }
    function addSplit() {
        let newCat = {
            recId: uuidv4(),
            cat: null,
            transAmount: 0,
        }
        setSplitArr(prevState => [...prevState, newCat]);
    }
    function deleteSplitCat(splitRecId: any) {
        setSplitArr(splitArr.filter(function (el) { return el.recId !== splitRecId; }));
    }
    function changeSplitAmount(splitRecId: string, newVal: any) {
        let newArr = splitArr.map(obj => {
            if (obj.recId === splitRecId) {
                return { ...obj, transAmount: newVal }
            }
            return obj;
        })
        //@ts-ignore
        setSplitArr(newArr);
    }
    function changeSplitCat(splitRecId: string, newVal: any) {
        let newArr = splitArr.map(obj => {
            if (obj.recId === splitRecId) {
                return { ...obj, cat: newVal }
            }
            return obj;
        })
        //@ts-ignore
        setSplitArr(newArr);
    }
    function allocateRest(splitRecId: string) {
        const otherTotal = splitArr
            .filter(obj => obj.recId !== splitRecId)
            .reduce((acc, obj) => acc + Number(obj.transAmount), 0);
        const remaining = Math.round((Number(transactionAmount) - otherTotal) * 100) / 100;
        changeSplitAmount(splitRecId, remaining > 0 ? remaining : 0);
    }
    const handleFocus = (event: any) => {
        if (event) {
            event.target.select()
        }
    };
    React.useEffect(() => {
        if (addNewTransaction) {
            // Set defaults when modal opens
            if (transactionType === null) {
                setTransactionType('expense')
            }
            return;
        }
        setTransactionTitle('')
        setTransactionAmount(0)
        setTransactionType('expense')
        setTransactionCategory(null)
        setTransactionDate(dayjs())
        setSplitBool(false)
        setSplitArr(splitArrDef)
        setErrorText('')
    }, [addNewTransaction])
    React.useEffect(() => {
        if (!splitBool) return;
        //@ts-ignore
        setTransactionType('expense')
        //@ts-ignore
        setSplitArr(splitArr.map(obj => {
            return { ...obj, cat: transactionCategory }
        }))
    }, [splitBool])
    return (
        <>
            <Dialog open={addNewTransaction}
                onClose={() => setAddNewTransaction(false)}
                scroll='paper'
                fullScreen={!bigger}
                slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}
            >
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }} component='form' onSubmit={handleSubmit}>
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <span>Nova Transação</span>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ToggleButton
                                value="check"
                                selected={splitBool}
                                size='small'
                                color="primary"
                                onChange={() => { setSplitBool(!splitBool); }}
                                sx={{ borderRadius: 2, px: 1.5, textTransform: 'none', fontWeight: 600 }}
                            >
                                <AltRouteIcon fontSize='small' sx={{ mr: 0.5 }} />
                                Dividir
                            </ToggleButton>
                            <IconButton onClick={() => setAddNewTransaction(false)}><CloseIcon /></IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent dividers>
                        {(currentBudget.month !== dayjs().locale('en').format('MMMM') || currentBudget.year !== Number(dayjs().format('YYYY'))) && (
                            <Alert severity="warning" variant="outlined" sx={{ py: 0, mb: 2 }}>
                                Você está lançando em {mesPt(currentBudget.month)} de {currentBudget.year}
                            </Alert>
                        )}

                        <TransactionFields
                            amount={transactionAmount}
                            onAmountChange={(v) => setTransactionAmount(v as any)}
                            amountLabel={splitBool ? 'Valor Total' : 'Valor'}
                            autoFocusAmount
                            focusAmountKey={addNewTransaction}
                            showTypeToggle={!splitBool}
                            type={transactionType}
                            onTypeChange={(t) => setTransactionType(t)}
                            date={transactionDate}
                            onDateChange={setTransactionDate}
                            title={transactionTitle}
                            onTitleChange={setTransactionTitle}
                            titleLabel={splitBool ? 'Título Geral' : 'Título'}
                            titleRequired
                            showCategory={!splitBool}
                            category={transactionCategory}
                            onCategoryChange={setTransactionCategory}
                            categoryGroups={categoryGroups}
                        />

                        {splitBool && (
                            <Box sx={{ mt: 2 }}>
                                {(() => {
                                    const left = Math.round((Number(transactionAmount) - splitArr.reduce((a, o) => a + Number(o.transAmount), 0)) * 100) / 100;
                                    const balanced = Math.abs(left) < 0.01;
                                    return (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                px: 1.5,
                                                py: 1,
                                                mb: 1.5,
                                                borderRadius: 2,
                                                bgcolor: (theme) => alpha(balanced ? theme.palette.success.main : theme.palette.warning.main, 0.12),
                                            }}
                                        >
                                            <Typography variant='subtitle2' color='text.secondary'>Falta distribuir</Typography>
                                            <Typography variant='subtitle2' sx={{ fontWeight: 700 }} color={balanced ? 'success.main' : 'warning.main'}>
                                                {formatter.format(left)}
                                            </Typography>
                                        </Box>
                                    );
                                })()}
                                <Stack spacing={1.5}>
                                    {splitArr.map((x, idx) => (
                                        <Paper
                                            key={x.recId}
                                            elevation={0}
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 2,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                    Dividir {idx + 1}
                                                </Typography>
                                                <IconButton
                                                    size='small'
                                                    onClick={() => deleteSplitCat(x.recId)}
                                                    disabled={splitArr.length <= 1}
                                                    aria-label='Remover divisão'
                                                >
                                                    <CloseIcon fontSize='small' />
                                                </IconButton>
                                            </Box>
                                            <Stack spacing={1.5}>
                                                <Autocomplete
                                                    disablePortal={false}
                                                    options={categoryGroups}
                                                    getOptionLabel={(option) => option.label}
                                                    groupBy={(option) => option.sectionName}
                                                    fullWidth
                                                    value={x.cat}
                                                    onChange={(event: any, newValue: any) => {
                                                        changeSplitCat(x.recId, newValue)
                                                    }}
                                                    renderInput={(params) => <TextField required onFocus={handleFocus} margin="none" {...params} label="Categoria" />}
                                                    renderOption={(props, option) => (
                                                        <li {...props} key={option.id}>
                                                            <Box display='flex' justifyContent='space-between' width='100%' gap={1}>
                                                                <span>{option.label}</span>
                                                                <Typography variant='body2' color={option.remaining < 0 ? 'error.main' : 'text.secondary'} sx={{ flexShrink: 0 }}>{formatter.format(option.remaining)}</Typography>
                                                            </Box>
                                                        </li>
                                                    )}
                                                    renderGroup={(params) => (
                                                        <li key={params.key}>
                                                            <GroupHeader>{params.group}</GroupHeader>
                                                            <GroupItems>{params.children}</GroupItems>
                                                        </li>
                                                    )}
                                                />
                                                <TextField
                                                    onFocus={handleFocus}
                                                    fullWidth
                                                    value={x.transAmount}
                                                    onChange={(event: any) => changeSplitAmount(x.recId, event.target.value)}
                                                    type="number"
                                                    slotProps={{
                                                        input: {
                                                            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                                                            endAdornment: (
                                                                <InputAdornment position="end">
                                                                    <Button
                                                                        size='small'
                                                                        onClick={() => allocateRest(x.recId)}
                                                                        startIcon={<ReadMoreOutlinedIcon fontSize='small' />}
                                                                        sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
                                                                    >
                                                                        Resto
                                                                    </Button>
                                                                </InputAdornment>
                                                            ),
                                                        },
                                                        htmlInput: { step: '.01' }
                                                    }}
                                                    placeholder='Valor'
                                                    label="Valor"
                                                    required
                                                />
                                            </Stack>
                                        </Paper>
                                    ))}
                                    <Button fullWidth variant='outlined' color='secondary' onClick={addSplit} startIcon={<AddIcon fontSize='small' />}>
                                        Adicionar Divisão
                                    </Button>
                                </Stack>
                            </Box>
                        )}
                    </DialogContent>
                    {errorText && <Box sx={{ mx: 2, mt: 1 }}><Typography color='error' variant='body2'>{errorText}</Typography></Box>}
                    <DialogActions sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1.5 }}>
                        <Button fullWidth startIcon={<AddIcon />} type='submit' variant='contained'>Nova Transação</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </>
    )
}
