# intoyun-ws-client
IntoYun Websocket 接入客户端

## 使用例子(ES6)
```javascript
import IntoYunSocket from 'intoyun-ws-client'
import Message from 'intoyun-ws-client/lib/message'

const socket = new IntoYunSocket('ws://iot.intoyun.com:8090/sub');

socket.onConnectionLost = function (responseObject) {
  if (responseObject.errorCode !== 0) {
    console.log(responseObject)
  }
}

/*
 * wireMessage {
 *   type: SEND_SMS, // 消息类型
 *   messageIdentifier: 1, // 消息序号，只有当type为SEND_SMS的时候才有
 *   payloadMessage: Message // Message类型结构体
 * }
 * payloadMessage 提供两个_get魔术函数：
 * 1. getPayloadString() 可以接收到消息体的字符串表示
 * 2. getPayloadBytes() 可以接收到消息体的十六进制Uint8Array
 */
socket.onMessageArrived = function (wireMessage) {
  console.log(wireMessage);
  socket.disconnect()
}

socket.connect({
  userName: `${username}`,
  password: `${password}`,
  onSuccess () {
    console.log('connect success');

    const message = new Message('Hello IntoYun');
    const type = 4; // SEND_SMS
    socket.send(type, message);
  },
  onFailure (error) {
    console.log(error)
  }
});

```
