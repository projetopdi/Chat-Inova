import juniorWordmark from '../assets/v3/junior-wordmark.svg'
import vitraWordmark from '../assets/v3/vitra-wordmark.svg'
import type { Modelo } from './modelos'

/**
 * Assets que trocam com o modelo (PRD v3 §2.2).
 *
 * Mapa tipado, nunca concatenação de string em caminho de arquivo: o `import`
 * é o que faz o Vite reescrever o caminho para o subdiretório /MEJ-AI-INTERFACE/
 * (§6.2 do v2), e um caminho montado em runtime quebraria em produção.
 *
 * A verificação byte a byte da Etapa 3 mostrou que o wordmark é o ÚNICO asset
 * realmente diferente entre os temas: marca d'água e botão de enviar têm a
 * mesma geometria e só mudam de cor, então são resolvidos por --cor-primaria
 * (mask-image e background) em vez de virarem um segundo arquivo.
 */
export const ASSETS_POR_MODELO = {
  junior: { wordmark: juniorWordmark, wordmarkAlt: 'Junior' },
  vitra: { wordmark: vitraWordmark, wordmarkAlt: 'Vitra' },
} as const satisfies Record<Modelo, { wordmark: string; wordmarkAlt: string }>
