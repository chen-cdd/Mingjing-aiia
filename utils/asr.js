// 引入百度语音识别配置
const BAIDU_CONFIG = require('../config/baidu-asr.js');

// 获取百度语音识别AccessToken
function getBaiduAccessToken() {
  return new Promise((resolve, reject) => {
    console.log('[ASR] 开始获取AccessToken');
    // 先检查本地存储的token是否有效
    const cachedToken = tt.getStorageSync('baidu_asr_token');
    const tokenTime = tt.getStorageSync('baidu_asr_token_time');
    
    if (cachedToken && tokenTime) {
      const now = Date.now();
      // token有效期30天，提前1天刷新
      if (now - tokenTime < 29 * 24 * 60 * 60 * 1000) {
        console.log('[ASR] 使用缓存的token');
        resolve(cachedToken);
        return;
      }
    }
    
    // 获取新token
    console.log('[ASR] 请求新token，URL:', BAIDU_CONFIG.tokenUrl);
    console.log('[ASR] API Key:', BAIDU_CONFIG.apiKey);
    tt.request({
      url: BAIDU_CONFIG.tokenUrl,
      method: 'POST',
      header: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: {
        grant_type: 'client_credentials',
        client_id: BAIDU_CONFIG.apiKey,
        client_secret: BAIDU_CONFIG.secretKey
      },
      success: (res) => {
        console.log('[ASR] Token请求响应:', res.data);
        if (res.data && res.data.access_token) {
          const token = res.data.access_token;
          tt.setStorageSync('baidu_asr_token', token);
          tt.setStorageSync('baidu_asr_token_time', Date.now());
          console.log('[ASR] Token获取成功');
          resolve(token);
        } else {
          console.log('[ASR] Token响应格式错误:', res.data);
          reject(new Error('获取AccessToken失败'));
        }
      },
      fail: (err) => {
        console.log('[ASR] Token请求失败:', err);
        reject(err);
      }
    });
  });
}

// 语音转文字函数
function transcribe(audioPath) {
  return new Promise(async (resolve, reject) => {
    // 设置30秒超时
    const timeoutId = setTimeout(() => {
      console.log('[ASR] 转录超时，30秒未完成');
      reject(new Error('语音转录超时，请重试'));
    }, 30000);
    
    try {
      console.log('[ASR] 开始语音转文字，音频路径:', audioPath);
      // 获取AccessToken
      const accessToken = await getBaiduAccessToken();
      console.log('[ASR] AccessToken获取成功');
      
      // 读取音频文件并转换为base64
      const fs = tt.getFileSystemManager();
      fs.readFile({
        filePath: audioPath,
        success: (res) => {
          console.log('[ASR] 音频文件读取成功，大小:', res.data.byteLength, 'bytes');
          const base64Audio = tt.arrayBufferToBase64(res.data);
          const audioSize = res.data.byteLength;
          console.log('[ASR] Base64转换完成，长度:', base64Audio.length);
          
          const requestData = {
               format: BAIDU_CONFIG.asrOptions.format,
               rate: BAIDU_CONFIG.asrOptions.rate,
               channel: BAIDU_CONFIG.asrOptions.channel,
               dev_pid: BAIDU_CONFIG.asrOptions.dev_pid,
               cuid: 'douyin_miniapp_' + Date.now(), // 用户唯一标识
               token: accessToken,
               speech: base64Audio,
               len: audioSize
             };
          
          console.log('[ASR] 请求参数:', {
            format: requestData.format,
            rate: requestData.rate,
            channel: requestData.channel,
            dev_pid: requestData.dev_pid,
            cuid: requestData.cuid,
            len: requestData.len,
            speechLength: requestData.speech.length
          });
          
          // 调用百度语音识别API
          console.log('[ASR] 发送识别请求到:', BAIDU_CONFIG.asrUrl);
          tt.request({
            url: BAIDU_CONFIG.asrUrl,
            method: 'POST',
            timeout: 25000, // 25秒请求超时
            header: {
              'Content-Type': 'application/json'
            },
            data: requestData,
            success: (response) => {
              clearTimeout(timeoutId);
              console.log('[ASR] API响应:', response.data);
              if (response.data && response.data.err_no === 0) {
                const result = response.data.result;
                if (result && result.length > 0) {
                  console.log('[ASR] 识别成功:', result[0]);
                  resolve(result[0]); // 返回识别结果
                } else {
                  console.log('[ASR] 识别结果为空');
                  reject(new Error('未识别到语音内容'));
                }
              } else {
                const errorMsg = response.data ? response.data.err_msg : '语音识别失败';
                const errorNo = response.data ? response.data.err_no : 'unknown';
                console.log('[ASR] 识别失败，错误码:', errorNo, '错误信息:', errorMsg);
                reject(new Error(`${errorMsg} (错误码: ${errorNo})`));
              }
            },
            fail: (err) => {
              clearTimeout(timeoutId);
              console.log('[ASR] 网络请求失败:', err);
              reject(new Error('网络请求失败: ' + err.errMsg));
            }
          });
        },
        fail: (err) => {
          clearTimeout(timeoutId);
          console.log('[ASR] 音频文件读取失败:', err);
          reject(new Error('读取音频文件失败: ' + err.errMsg));
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('[ASR] transcribe异常:', error);
      reject(error);
    }
  });
}

// 录音管理器配置
const getRecorderManager = () => {
  const recorderManager = tt.getRecorderManager();
  
  return {
    manager: recorderManager,
    options: BAIDU_CONFIG.recordOptions,
    start: () => recorderManager.start(BAIDU_CONFIG.recordOptions),
    stop: () => recorderManager.stop()
  };
};

module.exports = {
  transcribe,
  getBaiduAccessToken,
  getRecorderManager
};
