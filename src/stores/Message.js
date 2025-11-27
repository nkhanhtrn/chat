// Message abstraction for LM API
export default class Message {
  constructor({ id, question, response, parentId = null, children = [] }) {
    this.id = id
    this.question = question
    this.response = response
    this.parentId = parentId
    this.children = children // array of Message objects
  }

  addChild(child) {
    if (!(child instanceof Message)) {
      child = new Message(child)
    }
    this.children.push(child)
    child.parentId = this.messageId
  }
}
