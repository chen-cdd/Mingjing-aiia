module.exports = {

  apiKey: '85dXdmj8O8FusMv7a77tmfet',       
  secretKey: '051FMqNqjYjrBLviXecIU2JXnu8QP2XK', 
  
  tokenUrl: 'https://aip.baidubce.com/oauth/2.0/token',
  asrUrl: 'https://vop.baidu.com/server_api',
  
  // 语音识别参数配置
  asrOptions: {
    format: 'mp3',     // 音频格式：mp3, wav, pcm, m4a, amr
    rate: 16000,       // 采样率：8000, 16000
    channel: 1,        // 声道数：1（单声道）
    dev_pid: 1537,     // 语言模型：1537(普通话搜索模型), 1536(普通话输入法模型)
    speech: '',        // base64编码的音频数据
    len: 0             // 音频数据长度
  },
  
  // 录音参数配置
  recordOptions: {
    duration: 60000,      // 最长录音时间（毫秒）
    sampleRate: 16000,    // 采样率
    numberOfChannels: 1,  // 声道数
    encodeBitRate: 48000, // 编码码率
    format: 'mp3'         // 音频格式
  }
};
