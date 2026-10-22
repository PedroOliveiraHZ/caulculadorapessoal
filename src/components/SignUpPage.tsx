import React from 'react';
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button"
import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import {
    dialogPaperStyles,
    themes,
    useGlobalStore
} from "../store/globalStore";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from "@mui/material/CssBaseline";
import Grid from '@mui/material/Grid';
import Dialog from "@mui/material/Dialog";
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { supabase } from "../lib/supabase";
import logo from "../logo.png";
import Stack from "@mui/material/Stack";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

export default function SignUpPage() {
    const navigate = useNavigate();
    const [fullName, setFullName] = React.useState("");
    const setCurrentUser = useGlobalStore(s => s.setCurrentUser)
    const [emailText, setEmailText] = React.useState('')
    const [email, setEmail] = React.useState("");
    const [passwordText, setPasswordText] = React.useState('')
    const [passwordText1, setPasswordText1] = React.useState('')
    const [password, setPassword] = React.useState("");
    const [password1, setPassword1] = React.useState("");
    const setSnackText = useGlobalStore(s => s.setSnackBarText)
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity)
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen)
    const [errorText, setErrorText] = React.useState('')
    const currentTheme = useGlobalStore(s => s.themeAtom);
    const [showPassword, setShowPassword] = React.useState(false)
    const [signedUpBool, setSignedUpBool] = React.useState(false)
    const [loadingOpen, setLoadingOpen] = React.useState(false);
    const handleClickShowPassword = () => {
        setShowPassword(!showPassword)
    };
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };
    function validateForm() {
        if (fullName === '') {
            return false
        }
        if (email.length < 3) {
            return false
        }
        if (password.length < 5) {
            return false
        }
        return true
    }
    function validateFormFull() {
        if ((!email.includes('@')) || (email.length < 3)) {
            setEmailText('Informe um e-mail válido')
            return false
        }
        if (password.length < 8) {
            setPasswordText('A senha precisa ser maior')
            return false
        }
        if (password !== password1) {
            setPasswordText('As senhas precisam coincidir')
            return false
        }
        return true
    }

    async function supaSignUpFc(event: any) {
        event.preventDefault();
        setErrorText('')
        if (!validateFormFull()) return;

        setLoadingOpen(true)
        try {
            const { data: userData, error: signupErr } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            })
            if (signupErr) {
                if (signupErr.status === 429) {
                    setErrorText("Muitas tentativas. Aguarde um momento e tente novamente.")
                } else {
                    setErrorText(signupErr.message)
                }
                console.error(signupErr?.message, signupErr?.code)
                return
            }
            // Supabase returns an existing user with empty identities (instead of an error)
            // when the email is already registered — this prevents email enumeration.
            if (userData?.user?.identities?.length === 0) {
                setErrorText("Já existe um usuário com este e-mail")
                console.error("Signup returned existing user with no identities")
                return
            }

            // The public.users row is created automatically by a database trigger
            // on auth.users insert (handle_new_user function).
            if (userData?.user?.id) {
                setCurrentUser({
                    recordID: userData.user.id,
                    fullName: fullName,
                    userType: 'free'
                });
            }

            setSignedUpBool(true)
            setSnackSev('success')
            setSnackText('Cadastro realizado — confirme seu e-mail para entrar')
            setSnackOpen(true)
        } catch (error: any) {
            setErrorText(error?.message)
        } finally {
            setLoadingOpen(false)
        }
    }
    const handleRedirectSignUp = (event: any) => {
        event.preventDefault();
        navigate("/login", { replace: true });
    }
    const [actTheme, setTheme] = React.useState(themes.darkTheme)
    React.useEffect(() => {
        if (currentTheme === 'dark') {
            setTheme(themes.darkTheme)
        } else if (currentTheme === 'light') {
            setTheme(themes.lightTheme)
        }
    }, [currentTheme]);
    return (
        <>
            <ThemeProvider theme={actTheme}>
                <CssBaseline />
                <Box sx={{
                    width: '100%',
                    height: window.innerHeight,
                    backgroundColor: 'primary.light',
                }}>
                </Box>
                <Dialog open={true}
                    slotProps={{ paper: dialogPaperStyles }}>
                    <Box component='form'
                        onSubmit={supaSignUpFc}
                        sx={{
                            bgcolor: 'background.paper',
                            px: 3,
                            pb: 5,
                            pt: 3,
                            maxWidth: '300px'
                        }}
                    >
                        <Grid container rowSpacing={2}>
                            <Grid size={12} sx={{ my: 5 }}>
                                <Stack direction='row' alignItems='center'>
                                    <img
                                        height='50'
                                        src={logo}
                                        srcSet={`${logo}?w=164&h=164&fit=crop&auto=format&dpr=2 2x`}
                                        alt='logo'
                                        loading="lazy"
                                    />
                                    <Typography variant="h5" color='textSecondary' sx={{ ml: 1, fontWeight: 100 }}>simple</Typography>
                                    <Typography variant="h5" align="left" >
                                        Budget
                                    </Typography>
                                </Stack>
                            </Grid>
                            {signedUpBool ?
                                <>
                                    <Grid size={12} sx={{ mb: 0, pb: 1 }}>
                                        <Typography color='text.secondary' variant='h6' sx={{ fontWeight: '600' }}>Parabéns! Cadastro concluído.</Typography>
                                        <Typography variant='subtitle1' sx={{ fontWeight: '800' }}>Enviamos um e-mail — confirme-o antes de entrar.</Typography>
                                    </Grid>
                                    <Grid size={12} sx={{ mb: 0, pb: 1 }}>
                                        <Typography variant='subtitle2'>Pode fechar esta janela. O e-mail terá um link de volta para cá.</Typography>
                                    </Grid>
                                    <Grid size={12} sx={{ mb: 0, pb: 1 }}>
                                        <Typography variant='body2'>OBS: em instância self-hosted não há verificação de e-mail. Clique no link abaixo e entre.</Typography>
                                    </Grid>
                                    <Grid size={12} sx={{ mb: 0, pb: 1 }}>
                                        <Typography variant='body2' display='inline'>Caso contrário, clique <Button sx={{ m: 0, p: 0 }} size='small' onClick={handleRedirectSignUp}>AQUI</Button> para ir à página de login.</Typography>

                                    </Grid>
                                </>
                                :
                                <>
                                    <Grid size={12} sx={{ mb: 0, pb: 1 }}>
                                        <Typography variant='body2'>Cadastre-se para continuar.</Typography>
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            name="fullName"
                                            type="text"
                                            autoFocus
                                            label="Nome Completo"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            name="email"
                                            type="email"
                                            helperText={emailText}
                                            autoFocus
                                            error={emailText.length > 0}
                                            label="E-mail"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            label="Senha"
                                            helperText={passwordText}
                                            error={passwordText.length > 0}
                                            value={password}
                                            slotProps={{
                                                input: {
                                                    endAdornment: <InputAdornment position="end">
                                                        <IconButton
                                                            aria-label="mostrar/ocultar senha"
                                                            onClick={handleClickShowPassword}
                                                            onMouseDown={handleMouseDownPassword}
                                                            edge="end"
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>,
                                                },
                                            }}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            name="password1"
                                            type={showPassword ? 'text' : 'password'}
                                            label="Confirmar Senha"
                                            helperText={passwordText1}
                                            error={password !== password1}
                                            value={password1}
                                            slotProps={{
                                                input: {
                                                    endAdornment: <InputAdornment position="end">
                                                        <IconButton
                                                            aria-label="mostrar/ocultar senha"
                                                            onClick={handleClickShowPassword}
                                                            onMouseDown={handleMouseDownPassword}
                                                            edge="end"
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>,
                                                },
                                            }}
                                            onChange={(e) => setPassword1(e.target.value)}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <Typography color='error' variant='subtitle2'>{errorText}</Typography>
                                        <Button color='secondary' fullWidth variant='contained' disabled={!validateForm()} type='submit' sx={{ mt: 1 }}>Cadastre-se</Button>
                                    </Grid>
                                    <Grid size={12}>
                                        <Typography display='inline' variant='body2'>Já tem conta? </Typography>
                                        <Button size='small' onClick={handleRedirectSignUp}>Entrar</Button>
                                    </Grid>
                                </>
                            }
                        </Grid>
                    </Box>
                </Dialog>
                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 200 }}
                    open={loadingOpen}
                >
                    <CircularProgress color="inherit" />
                </Backdrop>
            </ThemeProvider>
        </>
    );
}
