import { useCallback, useReducer, useRef } from 'react'
import { askStream } from '../services/api'
import { MODELO_PADRAO, normalizarModelo, type Modelo } from '../constants/modelos'
import type { AppState, Conversation, Message } from '../types/chat'

type Action =
  | { type: 'CREATE_CONVERSATION'; modelo: Modelo }
  | { type: 'SET_MODELO'; conversationId: string; modelo: Modelo }
  | { type: 'SET_ACTIVE'; conversationId: string }
  | { type: 'SET_DRAFT'; conversationId: string; draft: string }
  | { type: 'ADD_MESSAGE'; conversationId: string; message: Message }
  | { type: 'APPEND_CHUNK'; conversationId: string; messageId: string; chunk: string }
  | { type: 'SET_STREAM_DONE'; conversationId: string; messageId: string }
  | { type: 'SET_STREAM_ERROR'; conversationId: string; messageId: string; error: string }
  | { type: 'SET_LOADING'; conversationId: string; isLoading: boolean }
  | { type: 'RESET_FOR_RETRY'; conversationId: string; messageId: string }
  | { type: 'RENAME_CONVERSATION'; conversationId: string; title: string }
  | { type: 'DELETE_CONVERSATION'; conversationId: string }

/** §4.2.3 e §8.3: limite aplicado ao DADO, não só ao CSS. */
export const MAX_TITULO = 60

/**
 * Higieniza um título vindo do usuário (§8.3).
 *
 * O nome é renderizado como texto puro pelo React, então XSS já está coberto —
 * isto aqui resolve o resto: caracteres de controle e de formatação (a classe
 * \p{Cf} inclui os overrides de direção como U+202E, que invertem visualmente
 * o texto e permitem disfarçar um nome), espaços repetidos e comprimento.
 */
export function sanitizarTitulo(bruto: string): string {
  return bruto
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITULO)
}

function createConversation(modelo: Modelo): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'Nova Conversa',
    titleManual: false,
    // normalizarModelo aqui também: é o valor que vai acabar escolhendo o
    // endpoint e indo para o data-modelo no DOM (§8.2).
    modelo: normalizarModelo(modelo),
    messages: [],
    draft: '',
    isLoading: false,
    createdAt: Date.now(),
  }
}

function truncateTitle(text: string, max = 30): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed
}

/**
 * Guarda contra "escrever em conversa fantasma" (§4.3.2, T31).
 *
 * O `.map()` só toca a conversa cujo id bate. Se ela foi excluída no meio de
 * um streaming, os APPEND_CHUNK que ainda chegarem simplesmente não encontram
 * destino e viram no-op — sem erro no console e sem ressuscitar a conversa.
 */
function updateConversation(
  state: AppState,
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): AppState {
  return {
    ...state,
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId ? updater(conversation) : conversation,
    ),
  }
}

function updateMessage(
  conversation: Conversation,
  messageId: string,
  updater: (message: Message) => Message,
): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.id === messageId ? updater(message) : message,
    ),
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_CONVERSATION': {
      const conversation = createConversation(action.modelo)
      return {
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
      }
    }
    // Só chega aqui quando a conversa está vazia (§3.2.1); o caso "conversa
    // já iniciada" é resolvido antes, criando uma conversa nova.
    case 'SET_MODELO':
      return updateConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        modelo: action.modelo,
      }))
    case 'SET_ACTIVE':
      return { ...state, activeConversationId: action.conversationId }
    case 'SET_DRAFT':
      return updateConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        draft: action.draft,
      }))
    case 'ADD_MESSAGE':
      return updateConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, action.message],
        // §4.2.6: o título automático só age enquanto o usuário não renomeou.
        title:
          !conversation.titleManual &&
          action.message.role === 'user' &&
          conversation.messages.length === 0
            ? truncateTitle(action.message.content)
            : conversation.title,
      }))
    case 'APPEND_CHUNK':
      return updateConversation(state, action.conversationId, (conversation) =>
        updateMessage(conversation, action.messageId, (message) => ({
          ...message,
          content: message.content + action.chunk,
        })),
      )
    case 'SET_STREAM_DONE':
      return updateConversation(state, action.conversationId, (conversation) =>
        updateMessage(conversation, action.messageId, (message) => ({
          ...message,
          isStreaming: false,
        })),
      )
    case 'SET_STREAM_ERROR':
      return updateConversation(state, action.conversationId, (conversation) =>
        updateMessage(conversation, action.messageId, (message) => ({
          ...message,
          isStreaming: false,
          error: action.error,
        })),
      )
    case 'SET_LOADING':
      return updateConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        isLoading: action.isLoading,
      }))
    case 'RESET_FOR_RETRY':
      return updateConversation(state, action.conversationId, (conversation) =>
        updateMessage(conversation, action.messageId, (message) => ({
          ...message,
          content: '',
          isStreaming: true,
          error: undefined,
        })),
      )
    case 'RENAME_CONVERSATION': {
      const title = sanitizarTitulo(action.title)
      // §4.2.3: nome vazio é rejeitado e o anterior permanece. Validar de novo
      // aqui (e não só na UI) mantém o reducer válido por si só.
      if (!title) return state
      return updateConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        title,
        titleManual: true,
      }))
    }
    case 'DELETE_CONVERSATION': {
      const alvo = state.conversations.find((c) => c.id === action.conversationId)
      if (!alvo) return state

      const restantes = state.conversations.filter((c) => c.id !== action.conversationId)

      // §4.3.2: a aplicação nunca fica sem conversa ativa. Excluir a última
      // cria uma nova e vazia, herdando o modelo da que saiu.
      if (restantes.length === 0) {
        const nova = createConversation(alvo.modelo)
        return { conversations: [nova], activeConversationId: nova.id }
      }

      // Excluir uma conversa que não é a ativa não muda a ativa — e, portanto,
      // não interfere num streaming em curso em outra aba (§4.3.2).
      if (state.activeConversationId !== action.conversationId) {
        return { ...state, conversations: restantes }
      }

      // Excluiu a ativa: assume a mais recente restante.
      const maisRecente = restantes.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
      return { conversations: restantes, activeConversationId: maisRecente.id }
    }
    default:
      return state
  }
}

function createInitialState(): AppState {
  const conversation = createConversation(MODELO_PADRAO)
  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
  }
}

const ERRO_REDE = 'Não foi possível conectar ao servidor do Chat Inova. Verifique sua conexão e tente novamente.'
const ERRO_GENERICO = 'Não foi possível obter a resposta. Tente novamente.'

/**
 * A mensagem crua do erro carrega a URL da API, o corpo bruto da resposta e a
 * stack — nada disso pode chegar à tela (§7.5). Classificamos e devolvemos um
 * texto fixo em português.
 *
 * Exportada para ser testável: é ela que decide o que o usuário lê no erro.
 */
export function toErrorMessage(error: unknown): string {
  // fetch rejeita com TypeError quando a requisição nem chega a completar:
  // offline, DNS, TLS e CORS caem todos aqui.
  if (error instanceof TypeError) return ERRO_REDE
  return ERRO_GENERICO
}

function logDetalheEmDev(contexto: string, error: unknown): void {
  // import.meta.env.DEV é substituído por false no build, então o minificador
  // remove este bloco inteiro da produção (§7.5).
  if (import.meta.env.DEV) {
    console.error(`[Chat Inova] ${contexto}`, error)
  }
}

export function useConversations() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  // Trava síncrona por conversa. O `isLoading` do estado só barra o segundo
  // envio depois que o React re-renderiza; este ref barra já no mesmo tick,
  // que é o caso do clique repetido muito rápido (§7.6, T16).
  const emVooRef = useRef<Set<string>>(new Set())

  // Espelho do estado para os callbacks assíncronos. Eles têm deps vazias (para
  // não se recriarem a cada tecla digitada), então não podem fechar sobre
  // `state` — leriam sempre o primeiro render. O modelo precisa ser resolvido
  // no momento do envio, a partir da conversa de destino.
  const stateRef = useRef(state)
  stateRef.current = state

  /** Modelo da conversa de destino, sempre normalizado (§3.3, §8.2). */
  const modeloDaConversa = useCallback((conversationId: string): Modelo => {
    const conversa = stateRef.current.conversations.find((c) => c.id === conversationId)
    return normalizarModelo(conversa?.modelo)
  }, [])

  const createConversationAction = useCallback((modelo: Modelo = MODELO_PADRAO) => {
    dispatch({ type: 'CREATE_CONVERSATION', modelo })
  }, [])

  /**
   * Regra da §3.2, o coração desta etapa.
   *
   * Conversa vazia: troca o modelo no lugar. Conversa já iniciada: NÃO
   * reescreve nada — abre uma conversa nova com o modelo escolhido, e a
   * anterior fica intacta (mensagens e rascunho), exatamente como em F1.
   */
  const selecionarModelo = useCallback((conversationId: string, modelo: Modelo) => {
    const conversa = stateRef.current.conversations.find((c) => c.id === conversationId)
    if (!conversa || conversa.modelo === modelo) return

    if (conversa.messages.length === 0) {
      dispatch({ type: 'SET_MODELO', conversationId, modelo })
    } else {
      dispatch({ type: 'CREATE_CONVERSATION', modelo })
    }
  }, [])

  const setActiveConversation = useCallback((conversationId: string) => {
    dispatch({ type: 'SET_ACTIVE', conversationId })
  }, [])

  /**
   * Devolve `false` quando o nome é rejeitado (vazio após sanitizar), para a
   * UI poder manter o campo aberto em vez de fingir que salvou.
   */
  const renomearConversa = useCallback((conversationId: string, title: string): boolean => {
    if (!sanitizarTitulo(title)) return false
    dispatch({ type: 'RENAME_CONVERSATION', conversationId, title })
    return true
  }, [])

  const excluirConversa = useCallback((conversationId: string) => {
    // A trava de envio precisa sair junto: sem isto, a conversa some mas o id
    // fica preso em emVooRef para sempre.
    emVooRef.current.delete(conversationId)
    dispatch({ type: 'DELETE_CONVERSATION', conversationId })
  }, [])

  const setDraft = useCallback((conversationId: string, draft: string) => {
    dispatch({ type: 'SET_DRAFT', conversationId, draft })
  }, [])

  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (emVooRef.current.has(conversationId)) return
    emVooRef.current.add(conversationId)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }
    dispatch({ type: 'ADD_MESSAGE', conversationId, message: userMessage })
    dispatch({ type: 'SET_DRAFT', conversationId, draft: '' })

    const assistantId = crypto.randomUUID()
    dispatch({
      type: 'ADD_MESSAGE',
      conversationId,
      message: {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        createdAt: Date.now(),
      },
    })
    dispatch({ type: 'SET_LOADING', conversationId, isLoading: true })

    // Capturado ANTES do await, junto com conversationId e assistantId: se o
    // usuário trocar de aba ou de modelo durante o streaming, esta resposta
    // continua saindo do endpoint que a originou (F6 + §3.2.4).
    const modelo = modeloDaConversa(conversationId)

    try {
      await askStream(modelo, trimmed, (chunk) => {
        dispatch({ type: 'APPEND_CHUNK', conversationId, messageId: assistantId, chunk })
      })
      dispatch({ type: 'SET_STREAM_DONE', conversationId, messageId: assistantId })
    } catch (error) {
      logDetalheEmDev('falha ao enviar mensagem', error)
      dispatch({
        type: 'SET_STREAM_ERROR',
        conversationId,
        messageId: assistantId,
        error: toErrorMessage(error),
      })
    } finally {
      emVooRef.current.delete(conversationId)
      dispatch({ type: 'SET_LOADING', conversationId, isLoading: false })
    }
  }, [modeloDaConversa])

  const retryMessage = useCallback(async (conversationId: string, messageId: string, question: string) => {
    const trimmed = question.trim()
    if (!trimmed) return
    if (emVooRef.current.has(conversationId)) return
    emVooRef.current.add(conversationId)

    dispatch({ type: 'RESET_FOR_RETRY', conversationId, messageId })
    dispatch({ type: 'SET_LOADING', conversationId, isLoading: true })

    const modelo = modeloDaConversa(conversationId)

    try {
      await askStream(modelo, trimmed, (chunk) => {
        dispatch({ type: 'APPEND_CHUNK', conversationId, messageId, chunk })
      })
      dispatch({ type: 'SET_STREAM_DONE', conversationId, messageId })
    } catch (error) {
      logDetalheEmDev('falha ao tentar novamente', error)
      dispatch({
        type: 'SET_STREAM_ERROR',
        conversationId,
        messageId,
        error: toErrorMessage(error),
      })
    } finally {
      emVooRef.current.delete(conversationId)
      dispatch({ type: 'SET_LOADING', conversationId, isLoading: false })
    }
  }, [modeloDaConversa])

  const activeConversation =
    state.conversations.find((conversation) => conversation.id === state.activeConversationId) ??
    state.conversations[0]

  return {
    state,
    activeConversation,
    createConversation: createConversationAction,
    selecionarModelo,
    renomearConversa,
    excluirConversa,
    setActiveConversation,
    setDraft,
    sendMessage,
    retryMessage,
  }
}
