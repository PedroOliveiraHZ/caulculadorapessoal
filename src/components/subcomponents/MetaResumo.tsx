import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { brl, useMetaProgresso } from '../../lib/meta';

/** Card compacto com a barra de progresso da meta, exibido no topo do Orçamento. */
export default function MetaResumo() {
    const { config, guardado, percentual, aportadoEsteMes, carregando } = useMetaProgresso();
    const bateuMes = aportadoEsteMes >= config.aporteMensal;
    return (
        <Paper
            component={RouterLink}
            to='/meta'
            elevation={4}
            sx={{ borderRadius: 3, p: 1.5, display: 'block', textDecoration: 'none', color: 'inherit', '&:hover': { boxShadow: 8 } }}
        >
            <Box display='flex' alignItems='center' gap={1}>
                <ApartmentIcon color='primary' fontSize='small' />
                <Typography variant='subtitle2' fontWeight={700} noWrap flexGrow={1}>{config.nome}</Typography>
                <Typography variant='caption' color={bateuMes ? 'success.main' : 'text.secondary'} noWrap>
                    {bateuMes ? '✅ aporte do mês' : `mês: ${brl.format(aportadoEsteMes)}/${brl.format(config.aporteMensal)}`}
                </Typography>
                <ChevronRightIcon fontSize='small' color='action' />
            </Box>
            <LinearProgress
                variant={carregando ? 'indeterminate' : 'determinate'}
                value={percentual}
                color={percentual >= 100 ? 'success' : 'primary'}
                sx={{ height: 10, borderRadius: 5, my: 1 }}
            />
            <Box display='flex' justifyContent='space-between'>
                <Typography variant='caption' fontWeight={600}>{brl.format(guardado)} ({percentual.toFixed(1)}%)</Typography>
                <Typography variant='caption' color='text.secondary'>meta {brl.format(config.valorMeta)}</Typography>
            </Box>
        </Paper>
    );
}
