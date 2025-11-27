// Message abstraction for LM API
export default class Message {
  static createChildMessage(parentMsg, question, highlightedText = null) {
    return new Message({
      id: crypto.randomUUID(),
      question,
      response: '',
      parentId: parentMsg.id,
      children: [],
      parent: parentMsg,
      highlightedText
    });
  }
  constructor({ id, question, response, parentId = null, children = [], parent = undefined, highlightedText = null }) {
    this.id = id
    this.question = question
    this.response = response
    this.parentId = parentId
    this.children = children // array of Message objects
    this.highlightedText = highlightedText // the text that was highlighted when creating this message
    if (parent !== undefined) this.parent = parent;
  }

  addChild(child) {
    if (!(child instanceof Message)) {
      child = new Message(child)
    }
    this.children.push(child)
    child.parentId = this.messageId
  }
}
