


          
我需要分析项目结构和代码内容，以便生成一份全面的README.md文件。首先，我将查看项目的主要文件和目录结构，了解项目的核心功能和组织方式。
        
            
toolName: view_folder
            
status: success
          
e:\明镜\langlangshan\明镜明镜
          
现在我需要查看项目的主要配置文件，以了解项目的基本信息和功能。首先查看app.json，这通常包含应用的基本配置信息。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\app.json
          
接下来我需要查看主应用文件app.js，了解应用的初始化逻辑和主要功能。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\app.js
          
我需要查看项目的主要页面文件，以了解应用的核心功能。从app.json中可以看出，mirror页面是首页，我将先查看这个页面的内容。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\pages\mirror\index.js
          
我需要查看一下utils目录下的文件，了解应用的核心功能实现。特别是llm.js和analyze.js，这些可能与应用的主要功能相关。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\utils\llm.js
          
我需要继续查看llm.js的剩余部分，以全面了解应用的LLM功能实现。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\utils\llm.js
          
我需要查看analyze.js文件，了解应用的分析功能实现。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\utils\analyze.js
          
我需要查看一下语音相关功能的实现，查看asr.js文件。
        
            
toolName: view_files
            
status: success
          
            
filePath: e:\明镜\langlangshan\明镜明镜\utils\asr.js
          
# 明镜 - 心理健康小程序

明镜是一款专注于心理健康和情绪管理的抖音小程序，通过AI驱动的对话和分析功能，帮助用户表达、理解和管理自己的情绪。

## 项目简介

明镜小程序以"平等、尊重、内在驱动、共同进化、平静深邃"为核心价值观，提供一个安全、私密的空间，让用户可以通过语音或文字表达自己的想法和情绪，获得AI的共情回应和客观分析，同时提供实用的情绪管理技巧和微练习。

### 主要功能

- **镜面交互**：通过独特的镜面界面进入应用
- **语音输入**：支持语音录制并自动转写为文本
- **文本分析**：分析用户输入的文本，提取关键信息和情绪
- **情感识别**：识别用户表达中的情绪类型和强度
- **对话引导**：提供共情回应和客观视角，帮助用户理解自己的情绪
- **微练习推荐**：根据用户情况推荐简短的情绪管理技巧和练习
- **内心世界**：提供用户历史会话和个人成长记录

## 安装指南

### 开发环境要求

- 抖音开发者工具
- 抖音小程序开发者账号

### 安装步骤

1. 克隆本仓库到本地
2. 使用抖音开发者工具打开项目目录
3. 在项目配置中设置自己的AppID
4. 在utils/llm.js中替换API密钥（正式环境建议通过服务端调用）
5. 编译并预览项目

## 使用说明

1. **首页镜面**：点击屏幕进入主菜单
2. **语音输入**：选择语音模式，点击录音按钮开始/暂停录音，完成后可查看转写文本
3. **文本输入**：选择文本模式，直接输入文字内容
4. **分析结果**：提交后查看AI分析的情绪、主题和摘要
5. **对话互动**：与AI进行对话，获取共情回应和客观建议
6. **练习技巧**：尝试AI推荐的情绪管理微练习

## 项目结构

```
├── app.js                 # 应用入口和全局数据
├── app.json               # 应用配置文件
├── app.ttss               # 全局样式
├── pages/                 # 页面目录
│   ├── mirror/            # 镜面首页
│   ├── voice/             # 语音输入页面
│   ├── text/              # 文本输入页面
│   ├── analysis/          # 分析结果页面
│   ├── chat/              # 对话交互页面
│   ├── rescue/            # 紧急救助页面
│   ├── inner/             # 内心世界页面
│   └── onboarding/        # 引导页面
└── utils/                 # 工具函数
    ├── analyze.js         # 文本分析功能
    ├── asr.js             # 语音识别功能
    └── llm.js             # LLM对话和分析功能
```

## 核心技术

- **语音识别**：使用抖音小程序的录音API和语音转文本功能
- **文本分析**：使用DeepSeek API进行文本分析和情感识别
- **对话生成**：基于LLM模型生成共情回应和客观建议
- **本地存储**：使用小程序存储API保存用户会话和设置

## 贡献指南

欢迎对明镜小程序进行改进和扩展。如果您想贡献代码，请遵循以下步骤：

1. Fork本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个Pull Request

### 开发注意事项

- 请确保代码符合项目的编码规范
- 添加新功能时请更新相关文档
- 尊重用户隐私，确保敏感数据处理符合相关规定

## 许可证

本项目采用 MIT 许可证 - 详情请参见 [LICENSE](LICENSE) 文件

## 联系方式

如有任何问题或建议，请通过以下方式联系我们：

- 项目维护者：weiduo
- 电子邮件：chenweiduo66960@gmail.com
- 项目仓库：https://github.com/chen-cdd/Mingjing-aiia

---

**明镜** - 照见内心，拥抱情绪，共同成长