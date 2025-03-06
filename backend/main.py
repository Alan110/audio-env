from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
from uuid import uuid4
from demucs import pretrained
from demucs.audio import AudioFile
from demucs.apply import apply_model
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建临时文件夹
UPLOAD_DIR = "temp/uploads"
OUTPUT_DIR = "temp/separated"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

logger.info("Starting application with directories:")
logger.info(f"Upload directory: {os.path.abspath(UPLOAD_DIR)}")
logger.info(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")

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

@app.post("/separate")
async def separate_audio(audio: UploadFile = File(...)):
    logger.info(f"Received audio file: {audio.filename}")
    try:
        # 生成唯一文件名
        file_id = str(uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}.wav")
        output_path = os.path.join(OUTPUT_DIR, file_id)
        os.makedirs(output_path, exist_ok=True)
        
        logger.debug(f"Created directories - Input: {input_path}, Output: {output_path}")
        
        # 保存上传的文件
        content = await audio.read()
        logger.debug(f"Read file content, size: {len(content)} bytes")
        
        with open(input_path, "wb") as f:
            f.write(content)
        logger.info(f"Saved uploaded file to {input_path}")
        
        # 加载音频
        try:
            wav = AudioFile(input_path).read()
            logger.debug(f"Audio file loaded successfully, shape: {wav.shape}")
        except Exception as e:
            logger.error(f"Error loading audio file: {str(e)}")
            raise HTTPException(status_code=400, detail="无法读取音频文件")
        
        # 分离音轨
        logger.info("Starting audio separation...")
        with torch.no_grad():
            try:
                sources = apply_model(model, wav, device='cuda' if torch.cuda.is_available() else 'cpu')
                logger.info("Audio separation completed successfully")
            except Exception as e:
                logger.error(f"Error during audio separation: {str(e)}")
                raise HTTPException(status_code=500, detail="音轨分离失败")
        
        # 保存分离后的音轨
        track_paths = {}
        for source, audio in zip(model.sources, sources):
            out_path = os.path.join(output_path, f"{source}.wav")
            try:
                # 处理音频数据
                processed_audio = process_audio_tensor(audio)
                
                # 保存音频文件
                torchaudio.save(out_path, processed_audio, model.samplerate)
                track_paths[source] = f"/audio/{file_id}/{source}.wav"
                logger.debug(f"Saved track {source} to {out_path}")
            except Exception as e:
                logger.error(f"Error saving track {source}: {str(e)}, audio shape: {processed_audio.shape if torch.is_tensor(processed_audio) else 'not a tensor'}")
                raise HTTPException(status_code=500, detail=f"保存音轨 {source} 失败")
        
        logger.info(f"All tracks saved successfully: {track_paths}")
        return track_paths
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        if os.path.exists(input_path):
            os.remove(input_path)
            logger.debug(f"Cleaned up input file: {input_path}")

@app.get("/audio/{file_id}/{track_name}")
async def get_audio_file(file_id: str, track_name: str):
    logger.debug(f"Requested audio file: {file_id}/{track_name}")
    file_path = os.path.join(OUTPUT_DIR, file_id, track_name)
    if not os.path.exists(file_path):
        logger.warning(f"Audio file not found: {file_path}")
        raise HTTPException(status_code=404, detail="音频文件不存在")
    logger.debug(f"Serving audio file: {file_path}")
    return FileResponse(file_path)