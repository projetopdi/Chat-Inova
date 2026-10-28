import type { Modelo } from '../constants/modelos'

export type Role = 'user' | 'assistant'

export type FeedbackType = 'up' | 'down' | null

export interface Message {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
  error?: string
  createdAt: number
  traceId?: string
  feedback?: FeedbackType
}

export interface Conversation {
  id: string
  title: string
  /**
   * §4.2.6: depois que o usuário renomeia à mão, o título vira fixo — a regra
   * automática do v1 (título derivado da 1ª mensagem) não pode mais
   * sobrescrevê-lo.
   */
  titleManual: boolean
  /**
   * PRD v3 §3.2: o modelo pertence à CONVERSA, não é estado global.
   *
   * O endpoint não recebe histórico e as bases de conhecimento são distintas,
   * então misturar respostas das duas IAs numa mesma thread produziria um
   * histórico incoerente. Por isso trocar de modelo numa conversa já iniciada
   * abre uma conversa nova em vez de reescrever esta.
   */
  modelo: Modelo
  messages: Message[]
  draft: string
  isLoading: boolean
  createdAt: number
}

export interface AppState {
  conversations: Conversation[]
  activeConversationId: string
}
