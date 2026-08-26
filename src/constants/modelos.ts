// Conteúdo por modelo (PRD v3 §2.2). Só entra aqui o que DIFERE entre Junior e
// Vitra; o que é igual nos dois vive no componente, não neste mapa.
//
// A chave é da união `Modelo`, nunca string livre: é o mesmo valor que indexa o
// mapa ENDPOINTS em api.ts e que vai para o atributo data-modelo (§8.2).

export const MODELOS = {
  junior: {
    nome: 'Junior',
    // Descrição exibida no popover de seleção (node 85:4032).
    descricao: 'Perguntas sobre empresas juniores',
    // Parágrafo de apresentação da tela vazia (node 85:3767), literal do Figma.
    apresentacao:
      'O Junior é uma inteligência artificial desenvolvida para auxiliar estudantes e integrantes do Movimento Empresa Júnior da Universidade Federal do Ceará. Seu objetivo é funcionar como um tira-dúvidas especializado, oferecendo respostas sobre Empresas Juniores e conteúdos relacionados à UFC.',
    // Chips de perguntas rápidas (nodes 85:3771, 85:3773, 85:3775). O texto é
    // enviado LITERALMENTE à IA (F4) — mudar aqui muda a pergunta.
    chips: [
      'Encontre editais, eventos ou oportunidades',
      'Tire dúvidas sobre a Universidade',
      'Quero participar de uma Empresa Júnior',
    ],
  },
  vitra: {
    nome: 'Vitra',
    // Node 85:4035. O Figma escreve "Pesquisas sobre à vitrine tecnologica da
    // UFC"; a crase e a falta de acento são erro de digitação do mockup, então
    // aqui vai a forma correta.
    descricao: 'Pesquisas sobre a Vitrine Tecnológica da UFC',
    // O node 85:4042 está vazio no Figma; este é o texto oficial fornecido pelo
    // autor do projeto, transcrito literalmente (inclusive o caixa-alta em
    // "VITRA", que é como a marca aparece no texto original).
    apresentacao:
      'A VITRA foi desenvolvida para facilitar o acesso e a consulta à Vitrine Tecnológica da Universidade Federal do Ceará (UFC). Seu objetivo é atuar como uma guia inteligente, ajudando usuários a encontrar informações sobre tecnologias, pesquisas, soluções e conhecimentos desenvolvidos na universidade.',
    // Nodes 85:4046, 85:4048, 85:4050.
    chips: [
      'Quais tecnologias estão disponíveis na Vitrine Tecnológica',
      'Quais tecnologias da UFC estão disponíveis para parceria ou transferência?',
      'Quais pesquisas e soluções inovadoras estão sendo desenvolvidas pela UFC?',
    ],
  },
} as const

export type Modelo = keyof typeof MODELOS

export const MODELO_PADRAO: Modelo = 'junior'

// Ordem de exibição no popover (node 85:4026): Junior acima, Vitra abaixo.
export const MODELOS_ORDENADOS: readonly Modelo[] = ['junior', 'vitra']

export function ehModelo(valor: unknown): valor is Modelo {
  return typeof valor === 'string' && Object.hasOwn(MODELOS, valor)
}

/**
 * Único portão de entrada para transformar um valor qualquer em `Modelo`
 * (PRD v3 §3.3 e §8.2).
 *
 * Existe porque o modelo decide DUAS coisas sensíveis: qual endpoint é
 * chamado e o que vai para o atributo `data-modelo` no DOM. Deixar um valor
 * arbitrário chegar a qualquer um dos dois é injeção — de URL no primeiro
 * caso, de atributo no segundo. Valor inválido cai no padrão e não se propaga.
 */
export function normalizarModelo(valor: unknown): Modelo {
  if (ehModelo(valor)) return valor
  if (import.meta.env.DEV) {
    console.warn(`[Chat Inova] modelo inválido (${String(valor)}); usando "${MODELO_PADRAO}"`)
  }
  return MODELO_PADRAO
}
