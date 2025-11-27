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

  constructor({ id, question, response, parentId = null, childIds = [], highlightedText = null, questionSummarized = null, lastVisitedChild = null }) {
    this.id = id
    this.question = question
    this.questionSummarized = questionSummarized || (question.length > 100 ? question.slice(0, 100) + '...' : question)
    this.response = response
    this.parentId = parentId
    this.childIds = childIds
    this.highlightedText = highlightedText
    this.lastVisitedChild = lastVisitedChild
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

  updateQuestionSummarized(summary) {
    // If summary is provided, use it directly
    if (summary) {
      this.questionSummarized = summary;
    } else {
      // Otherwise, set questionSummarized to the first line of response and remove it from response
      if (typeof this.response === 'string') {
        const lines = this.response.split('\n');
        this.questionSummarized = lines[0];
        this.response = lines.slice(1).join('\n');
      }
    }
  }
}
