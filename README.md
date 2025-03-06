# 音轨分离训练系统 (Audio Track Separator)

## 项目介绍

这是一个基于AI的音频分轨工具，可以将音乐文件（MP3/MP4）分离成人声、鼓、贝斯、吉他和其他伴奏等独立音轨。主要用于：
- 个人音乐训练（如吉他练习）
- 音乐教育
- 音轨混音制作

### 核心功能
- 🎵 音轨分离：将音频文件分离成5个独立音轨
- 🎚️ 独立音量控制：可以调节每个音轨的音量
- 🔇 静音控制：可以单独开关任意音轨
- ⏩ 播放速度调节：支持0.5x-2x速度调节
- 🎯 同步播放：所有音轨完美同步

## 技术架构

### 前端技术栈
- React.js
- Web Audio API
- XMLHttpRequest（文件上传进度监控）
- CSS3（界面样式）

### 后端技术栈
- Python FastAPI
- Spleeter (AI音频分离模型)
- UUID (文件唯一标识)
- 文件系统管理

### 系统架构图 


## 使用说明

1. 上传音频文件
   - 支持的格式：MP3, MP4
   - 建议文件大小：<50MB

2. 等待处理
   - 系统会显示处理进度
   - 处理时间取决于文件大小和服务器性能

3. 控制播放
   - 使用播放/暂停按钮控制整体播放
   - 调节各音轨音量
   - 使用静音按钮开关音轨
   - 调节播放速度

## 维护说明

### 日常维护
1. 临时文件清理
   - 系统自动清理24小时前的文件
   - 可以通过修改 `cleanup_old_files()` 中的时间设置

2. 性能监控
   - 监控服务器CPU和内存使用
   - 监控磁盘空间使用情况

### 常见问题处理
1. 音频处理失败
   - 检查文件格式是否支持
   - 检查文件是否损坏
   - 查看服务器日志

2. 音轨不同步
   - 检查浏览器版本
   - 清除浏览器缓存
   - 重新加载页面

## 开发计划

### 近期计划
- [ ] 添加波形显示
- [ ] 支持更多音频格式
- [ ] 添加音频导出功能
- [ ] 优化处理速度

### 未来展望
- 支持更多音轨分离选项
- 添加音效处理功能
- 添加云存储支持
- 添加用户系统

## 贡献指南

欢迎提交 Pull Request 或 Issue。请确保：
1. 代码符合项目规范
2. 提供完整的测试
3. 更新相关文档

## 许可证

MIT License

## 联系方式

- 项目维护者：[您的名字]
- 邮箱：[您的邮箱]
- GitHub：[项目地址]



## 问题

The error occurs because TensorFlow 2.5.0 isn't available for your macOS ARM64 (Apple Silicon) architecture. Here are the solutions:  

### Solution 1: Use Conda Environment

```bash
# Install miniforge for M1/M2 Mac
brew install miniforge

# Create conda environment with Python 3.9
conda create -n audio-env python=3.9
conda activate audio-env

# Install tensorflow and other dependencies
conda install tensorflow-deps
pip install tensorflow-macos==2.9.0
pip install tensorflow-metal==0.5.0
pip install -r requirements.txt
```

### Solution 2: Use Docker

```bash
# Build Docker image
docker build -t audio-separator .

# Run container
docker run -p 8000:8000 audio-separator
```

### Solution 3: Use Different TensorFlow Version

Update requirements.txt to use a compatible version:
```
tensorflow-macos>=2.9.0
tensorflow-metal>=0.5.0
```  


# 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000
目前前端服务启动只有3000端口能顺利把请求打到服务端，3000端口跟信用卡的项目冲突，需要注意. 但是我已经设置允许任意ip访问，可能没有生效。

# 音频分离

--two-stems 和 --three-stems：这两个参数不能同时使用。您需要选择一个。请修改为只使用 --three-stems，如下所示
cmd = [
    "python", "-m", "demucs.separate",
    "-n", "htdemucs",
    "--three-stems=drums,bass,guitar,vocals",  # 提取人声、鼓和贝斯
    "-o", os.path.dirname(output_path),
    input_path
]

默认是分成4轨，如果要再单独分离吉他，需要单独处理