# intoyun-ws-client
IntoYun Websocket 接入客户端

#使用例子(ES6)
```javascript
import IntoYunSocket from 'intoyun-ws-client'
import Message from 'intoyun-ws/client/message'

const socket = new IntoYunSocket('ws://iot.intoyun.com:8090/sub');

socket.onConnectionLost = function (responseObject) {
  if (responseObject.errorCode !== 0) {
    console.log(responseObject)
  }
}

/*
 * wireMessage 是一个结构体。type表示消息类型，payloadMessage是一个Message类型结构体。
 * messageIdentifier 是SEND_SMS 消息类型的序号（可不关心）。
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
