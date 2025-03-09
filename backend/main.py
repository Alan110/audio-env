import os
import hashlib
import glob
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from uuid import uuid4
from demucs import pretrained
from demucs.audio import AudioFile
import torch
import torchaudio
import numpy as np
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建临时文件夹
UPLOAD_DIR = "temp/uploads"
AUDIO_DIR = "temp/audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

logger.info("Starting application with directories:")
logger.info(f"Upload directory: {os.path.abspath(UPLOAD_DIR)}")
logger.info(f"Audio directory: {os.path.abspath(AUDIO_DIR)}")

# 加载模型
try:
    model = pretrained.get_model('htdemucs')
    model.cuda() if torch.cuda.is_available() else model.cpu()
    logger.info(f"Model loaded successfully. Using device: {'cuda' if torch.cuda.is_available() else 'cpu'}")
except Exception as e:
    logger.error(f"Error loading model: {str(e)}")
    raise

def process_audio_tensor(audio):
    """处理音频张量，确保格式正确"""
    if not torch.is_tensor(audio):
        return audio
    
    audio = audio.cpu()
    # 记录原始形状
    logger.debug(f"Original audio tensor shape: {audio.shape}")
    
    # 如果是3D张量 [segments, channels, samples]，转换为2D [channels, samples]
    if audio.ndim == 3:
        # 如果第一维是4（可能是4个音轨段），我们需要平均它们
        if audio.shape[0] == 4:
            audio = audio.mean(dim=0)
        else:
            audio = audio.squeeze(0)
    
    logger.debug(f"Processed audio tensor shape: {audio.shape}")
    return audio

def calculate_file_hash(content):
    """计算文件内容的哈希值"""
    hasher = hashlib.sha256()
    hasher.update(content)
    return hasher.hexdigest()

@app.post("/separate")
async def separate_audio(audio: UploadFile = File(...), cache_enabled: bool = Form(True)):
    logger.info(f"Received audio file: {audio.filename}")
    try:
        # 读取文件内容
        content = await audio.read()
        file_hash = calculate_file_hash(content)
        logger.debug(f"Calculated file hash: {file_hash}")
        
        # 初始化 input_path
        input_path = None
        
        if cache_enabled:
            # 检查缓存
            audio_path = os.path.join(AUDIO_DIR, file_hash)
            if os.path.exists(audio_path):
                logger.info(f"Found cached audio for hash: {file_hash}")
                track_paths = {}
                for stem in ['vocals', 'drums', 'bass', 'guitar', 'other']:
                    track_file = os.path.join(audio_path, f"{stem}.wav")
                    if os.path.exists(track_file):
                        track_paths[stem] = f"/audio/{file_hash}/{stem}.wav"
                return track_paths

        # 生成唯一文件名
        file_id = str(uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}.wav")
        output_path = os.path.join(AUDIO_DIR, file_hash)
        os.makedirs(output_path, exist_ok=True)
        
        logger.debug(f"Created directories - Input: {input_path}, Output: {output_path}")
        
        # 保存上传的文件
        with open(input_path, "wb") as f:
            f.write(content)
        logger.info(f"Saved uploaded file to {input_path}")
        
        # 分离音轨
        logger.info("Starting audio separation...")
        try:
            # 使用命令行接口分离音频
            cmd = [
                "python", "-m", "demucs.separate", 
                "-n", "htdemucs", 
                "-o", os.path.dirname(output_path),
                "-j", "4",
                input_path
            ]
            logger.debug(f"Running command: {' '.join(cmd)}")
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            logger.debug(f"Command output: {process.stdout}")
            if process.stderr:
                logger.warning(f"Command stderr: {process.stderr}")
            
            logger.info("Audio separation completed successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Command '{e.cmd}' returned non-zero exit status {e.returncode}.")
            logger.error(f"Output: {e.output}")
            logger.error(f"Error: {e.stderr}")
            raise HTTPException(status_code=500, detail="音轨分离失败")
        except Exception as e:
            logger.error(f"Error during audio separation: {str(e)}")
            raise HTTPException(status_code=500, detail="音轨分离失败")
        
        # 构建音轨路径
        track_paths = {}
        
        # 查找 demucs 生成的文件
        # demucs 默认会在 separated/htdemucs/[filename] 目录下创建文件
        demucs_output_dir = os.path.join(os.path.dirname(output_path), "htdemucs")
        
        # 查找生成的文件夹
        potential_dirs = glob.glob(os.path.join(demucs_output_dir, "*"))
        logger.debug(f"Found potential output directories: {potential_dirs}")
        
        # 查找包含分离音轨的目录
        for dir_path in potential_dirs:
            if os.path.isdir(dir_path):
                # 查找所有 .wav 文件
                wav_files = glob.glob(os.path.join(dir_path, "*.wav"))
                logger.debug(f"Found wav files in {dir_path}: {wav_files}")
                
                for wav_file in wav_files:
                    # 获取音轨名称（文件名）
                    stem = os.path.splitext(os.path.basename(wav_file))[0]
                    
                    # 复制到音频目录
                    target_path = os.path.join(output_path, f"{stem}.wav")
                    os.system(f"cp '{wav_file}' '{target_path}'")

                    # 添加到返回路径
                    track_paths[stem] = f"/audio/{file_hash}/{stem}.wav"
                    logger.debug(f"Found and copied track: {stem} from {wav_file} to {target_path}")
        
        logger.info(f"All tracks saved successfully: {track_paths}")
        return track_paths
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        if input_path and os.path.exists(input_path):
            os.remove(input_path)
            logger.debug(f"Cleaned up input file: {input_path}")

@app.get("/audio/{file_hash}/{track_name}")
async def get_audio_file(file_hash: str, track_name: str):
    logger.debug(f"Requested audio file: {file_hash}/{track_name}")
    file_path = os.path.join(AUDIO_DIR, file_hash, track_name)
    if not os.path.exists(file_path):
        logger.warning(f"Audio file not found: {file_path}")
        raise HTTPException(status_code=404, detail="音频文件不存在")
    logger.debug(f"Serving audio file: {file_path}")
    return FileResponse(file_path)
