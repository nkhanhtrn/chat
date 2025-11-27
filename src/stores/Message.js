// Message abstraction for LM API
export default class Message {
  static createChildMessage(parentId, question, highlightedText = null) {
    return new Message({
      id: crypto.randomUUID(),
      question,
      response: '',
      parentId,
      childIds: [],
      highlightedText
    });
  }

  constructor({ id, question, response, parentId = null, childIds = [], highlightedText = null }) {
    this.id = id
    this.question = question
    this.response = response
    this.parentId = parentId
    this.childIds = childIds // array of child message IDs (normalized structure)
    this.highlightedText = highlightedText // the text that was highlighted when creating this message
  }

  // Check if this message has any children
  get hasChildren() {
    return this.childIds && this.childIds.length > 0
  }
}
