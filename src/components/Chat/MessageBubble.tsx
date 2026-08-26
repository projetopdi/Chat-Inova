import { useConversationsContext } from '../../hooks/useConversationsContext'
import type { Message } from '../../types/chat'
import MarkdownMessage from './MarkdownMessage'
import CopyButton from './CopyButton'
import './MessageBubble.css'

interface MessageBubbleProps {
  message: Message
  conversationId: string
  retryQuestion?: string
}

function MessageBubble({ message, conversationId, retryQuestion }: MessageBubbleProps) {
  const { retryMessage } = useConversationsContext()
  const isUser = message.role === 'user'
  const isTyping = !isUser && message.isStreaming && message.content.length === 0
  const canCopy = !isUser && !message.isStreaming && !message.error

  return (
    <div className={`message-bubble message-bubble--${message.role}`}>
      <div className="message-bubble__content">
        {isTyping ? (
          <div className="message-bubble__typing" aria-label="Chat Inova está digitando">
            <span />
            <span />
            <span />
          </div>
        ) : isUser ? (
          <p className="message-bubble__text">{message.content}</p>
        ) : (
          <MarkdownMessage content={message.content} />
        )}

        {message.error && (
          <div className="message-bubble__error">
            <span>{message.error}</span>
            {retryQuestion && (
              <button
                type="button"
                className="message-bubble__retry"
                onClick={() => retryMessage(conversationId, message.id, retryQuestion)}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}
      </div>

      {canCopy && <CopyButton text={message.content} />}
    </div>
  )
}

export default MessageBubble
