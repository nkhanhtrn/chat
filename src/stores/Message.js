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
    this.questionSummarized = question.length > 100 ? question.slice(0, 100) + '...' : question
    this.response = response
    this.parentId = parentId
    this.childIds = childIds
    this.highlightedText = highlightedText
    this.lastVisitedChild = null
  }

  
  // Check if this message has any children
  get hasChildren() {
    return this.childIds && this.childIds.length > 0
  }
  set addNewChild(childId) {
    if (!this.childIds) {
      this.childIds = []
    }
    this.childIds.push(childId)
    this.lastVisitedChild = childId
  }
}
