# 百度语音识别API集成指南

本项目已集成百度语音识别API，支持在抖音小程序中实现语音转文字功能。

## 🚀 快速开始

### 1. 申请百度语音识别服务

1. 访问 [百度AI开放平台](https://ai.baidu.com/tech/speech/asr)
2. 注册/登录百度账号
3. 创建应用，选择"语音识别"服务
4. 获取 `API Key` 和 `Secret Key`

### 2. 配置API密钥

编辑 `config/baidu-asr.js` 文件，将以下信息替换为您的实际配置：

```javascript
module.exports = {
  apiKey: 'YOUR_API_KEY',        // 替换为您的API Key
  secretKey: 'YOUR_SECRET_KEY',  // 替换为您的Secret Key
  // ... 其他配置
};
```

### 3. 配置小程序域名

在抖音小程序后台的"开发管理" → "开发设置" → "服务器域名"中添加：

**request合法域名：**
- `https://openapi.baidu.com`
- `https://vop.baidu.com`

### 4. 开始使用

配置完成后，您就可以在语音页面使用语音转文字功能了！

## 📁 文件结构

```
├── config/
│   └── baidu-asr.js          # 百度语音识别配置文件
├── utils/
│   └── asr.js                # 语音识别核心功能
├── pages/
│   └── voice/
│       ├── index.js          # 语音页面逻辑
│       ├── index.ttml        # 语音页面模板
│       └── index.ttss        # 语音页面样式
└── README-百度语音识别.md     # 本说明文件
```

## 🔧 核心功能

### transcribe(audioPath)

语音转文字的核心函数，支持以下特性：

- **自动token管理**：自动获取和缓存百度API的AccessToken
- **多格式支持**：支持mp3、wav、pcm、m4a、amr等音频格式
- **错误处理**：完善的错误处理和用户提示
- **配置灵活**：通过配置文件轻松调整参数

**使用示例：**

```javascript
const { transcribe } = require('../../utils/asr.js');

// 在录音结束后调用
recorder.onStop = async (res) => {
  try {
    const text = await transcribe(res.tempFilePath);
    console.log('识别结果：', text);
  } catch (error) {
    console.error('识别失败：', error.message);
  }
};
```

### getRecorderManager()

获取配置好的录音管理器：

```javascript
const { getRecorderManager } = require('../../utils/asr.js');

const recorder = getRecorderManager();
recorder.start(); // 开始录音
recorder.stop();  // 停止录音
```

## ⚙️ 配置说明

### 语音识别参数

| 参数 | 说明 | 可选值 |
|------|------|--------|
| format | 音频格式 | mp3, wav, pcm, m4a, amr |
| rate | 采样率 | 8000, 16000 |
| channel | 声道数 | 1（单声道） |
| dev_pid | 语言模型 | 1537（搜索）, 1536（输入法）, 1737（英语）, 1637（粤语）, 1837（四川话） |

### 录音参数

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| duration | 最长录音时间（毫秒） | 60000 |
| sampleRate | 采样率 | 16000 |
| numberOfChannels | 声道数 | 1 |
| encodeBitRate | 编码码率 | 48000 |
| format | 音频格式 | mp3 |

## 💰 费用说明

- **免费额度**：每天50,000次调用
- **超出后计费**：按调用次数收费
- **音频限制**：单次识别不超过60秒，文件不超过10MB

## 🔍 常见问题

### Q: 提示"获取AccessToken失败"
**A:** 请检查API Key和Secret Key是否正确配置。

### Q: 提示"网络请求失败"
**A:** 请确认已在小程序后台配置了百度API的域名白名单。

### Q: 识别准确率不高
**A:** 可以尝试：
- 调整dev_pid参数选择合适的语言模型
- 确保录音环境安静
- 使用16000Hz采样率

### Q: 录音无法开始
**A:** 请确认：
- 用户已授权麦克风权限
- 设备支持录音功能
- 抖音客户端版本支持getRecorderManager

## 📞 技术支持

如遇到问题，可以：
1. 查看抖音小程序开发文档
2. 参考百度语音识别API文档
3. 检查浏览器控制台的错误信息

## 🔄 更新日志

### v1.0.0
- ✅ 集成百度语音识别API
- ✅ 支持自动token管理
- ✅ 完善的错误处理
- ✅ 灵活的配置系统
- ✅ 支持多种音频格式

---

**注意**：使用前请确保遵守百度AI开放平台的使用条款和相关法律法规。