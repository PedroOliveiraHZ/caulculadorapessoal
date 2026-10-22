import React from 'react';
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { dialogPaperStyles, themes, useGlobalStore } from "../store/globalStore";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from "@mui/material/CssBaseline";
import Grid from '@mui/material/Grid';
import Dialog from "@mui/material/Dialog";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Alert from '@mui/material/Alert';
import Stack from "@mui/material/Stack";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import logo from "../logo.png";
import {
    setCustomSupabaseConfig,
    resetToProductionSupabase,
    isCustomSupabaseConfig,
    isSelfHostedConfig,
} from "../lib/supabase";

export default function SupabaseConfigPage() {
    const navigate = useNavigate();
    const currentTheme = useGlobalStore(s => s.themeAtom);

    const existingConfig = localStorage.getItem('supabaseCustomConfig');
    const parsed = existingConfig ? JSON.parse(existingConfig) : null;

    const [mode, setMode] = React.useState<'production' | 'custom'>(
        isCustomSupabaseConfig() ? 'custom' : 'production'
    );
    const [url, setUrl] = React.useState(parsed?.url || '');
    const [apiKey, setApiKey] = React.useState(parsed?.key || '');
    const [vapidKey, setVapidKey] = React.useState(localStorage.getItem('vapidPublicKey') || '');
    const [saved, setSaved] = React.useState(false);
    const [error, setError] = React.useState('');

    const [actTheme, setTheme] = React.useState(themes.darkTheme);
    React.useEffect(() => {
        if (currentTheme === 'dark') {
            setTheme(themes.darkTheme);
        } else if (currentTheme === 'light') {
            setTheme(themes.lightTheme);
        }
    }, [currentTheme]);

    function handleSave() {
        setError('');
        setSaved(false);

        if (mode === 'production') {
            resetToProductionSupabase();
            localStorage.removeItem('vapidPublicKey');
            setSaved(true);
            return;
        }

        // Validate custom inputs
        if (!url.trim()) {
            setError('A URL do Supabase é obrigatória.');
            return;
        }
        if (!apiKey.trim()) {
            setError('A chave da API do Supabase é obrigatória.');
            return;
        }
        try {
            new URL(url.trim());
        } catch {
            setError('Informe uma URL válida.');
            return;
        }

        setCustomSupabaseConfig(url.trim(), apiKey.trim());
        // Save VAPID public key if provided (optional — needed for push notifications)
        if (vapidKey.trim()) {
            localStorage.setItem('vapidPublicKey', vapidKey.trim());
        } else {
            localStorage.removeItem('vapidPublicKey');
        }
        setSaved(true);
    }

    return (
        <ThemeProvider theme={actTheme}>
            <CssBaseline />
            <Box sx={{
                width: '100%',
                height: '100vh',
                backgroundColor: 'primary.light',
            }} />
            <Dialog open={true} slotProps={{ paper: dialogPaperStyles }}>
                <Box sx={{
                    bgcolor: 'background.paper',
                    px: 3,
                    pb: 4,
                    pt: 3,
                    maxWidth: '360px',
                }}>
                    <Grid container rowSpacing={2}>
                        <Grid size={12}>
                            <Stack direction='row' alignItems='center' spacing={1}>
                                <IconButton
                                    aria-label="voltar ao login"
                                    onClick={() => navigate('/login')}
                                    size="small"
                                >
                                    <ArrowBackIcon />
                                </IconButton>
                                <img
                                    height='36'
                                    src={logo}
                                    srcSet={`${logo}?w=164&h=164&fit=crop&auto=format&dpr=2 2x`}
                                    alt='logo'
                                    loading="lazy"
                                />
                                <Typography variant="h6">
                                    Configuração do Backend
                                </Typography>
                            </Stack>
                        </Grid>

                        <Grid size={12}>
                            <Typography variant='body2' color='textSecondary'>
                                Use o backend padrão ou conecte ao seu próprio Supabase.
                            </Typography>
                        </Grid>

                        {isSelfHostedConfig() && (
                            <Grid size={12}>
                                <Alert severity="info" variant="outlined">
                                    Esta instância já tem um backend configurado pelo host. Você ainda pode sobrescrevê-lo neste navegador abaixo.
                                </Alert>
                            </Grid>
                        )}

                        <Grid size={12}>
                            <FormControl>
                                <FormLabel id="backend-selection-label">Backend</FormLabel>
                                <RadioGroup
                                    aria-labelledby="backend-selection-label"
                                    value={mode}
                                    onChange={(e) => {
                                        setMode(e.target.value as 'production' | 'custom');
                                        setSaved(false);
                                        setError('');
                                    }}
                                >
                                    <FormControlLabel
                                        value="production"
                                        control={<Radio />}
                                        label="Produção (padrão)"
                                    />
                                    <FormControlLabel
                                        value="custom"
                                        control={<Radio />}
                                        label="Supabase próprio"
                                    />
                                </RadioGroup>
                            </FormControl>
                        </Grid>

                        {mode === 'custom' && (
                            <>
                                <Grid size={12}>
                                    <TextField
                                        fullWidth
                                        label="Supabase URL"
                                        placeholder="https://your-project.supabase.co"
                                        value={url}
                                        onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
                                    />
                                </Grid>
                                <Grid size={12}>
                                    <TextField
                                        fullWidth
                                        label="Supabase Anon Key"
                                        placeholder="your-anon-key-here"
                                        value={apiKey}
                                        onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
                                        multiline
                                        maxRows={3}
                                    />
                                </Grid>
                                <Grid size={12}>
                                    <TextField
                                        fullWidth
                                        label="Chave pública VAPID (opcional)"
                                        placeholder="BPe7K...base64url-encoded..."
                                        helperText="Necessária para notificações push. Fica no arquivo .env do servidor."
                                        value={vapidKey}
                                        onChange={(e) => { setVapidKey(e.target.value); setSaved(false); }}
                                        multiline
                                        maxRows={2}
                                    />
                                </Grid>
                            </>
                        )}

                        {error && (
                            <Grid size={12}>
                                <Alert severity="error">{error}</Alert>
                            </Grid>
                        )}

                        {saved && (
                            <Grid size={12}>
                                <Alert severity="success">
                                    Configuração salva. Volte ao login para entrar.
                                </Alert>
                            </Grid>
                        )}

                        <Grid size={12}>
                            <Button
                                fullWidth
                                variant='contained'
                                onClick={handleSave}
                                sx={{ mt: 1 }}
                            >
                                Salvar Configuração
                            </Button>
                        </Grid>

                        <Grid size={12}>
                            <Button
                                fullWidth
                                size='small'
                                onClick={() => navigate('/login')}
                            >
                                Voltar ao Login
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Dialog>
        </ThemeProvider>
    );
}
