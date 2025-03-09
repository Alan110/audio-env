export const uploadFile = async (file, onProgress, onError, cacheMode = true) => {
  if (!file) {
    throw new Error('未选择文件');
  }

  const formData = new FormData();
  formData.append('audio', file);
  formData.append('cache_enabled', cacheMode);

  try {
    const xhr = new XMLHttpRequest();
    
    // 创建上传进度Promise
    const uploadPromise = new Promise((resolve, reject) => {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(Math.round(percentComplete));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (err) {
            reject(new Error('服务器响应格式错误'));
          }
        } else {
          reject(new Error(`上传失败: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('网络错误'));
      };
    });

    // 发送请求
    xhr.open('POST', 'http://localhost:8000/separate', true);
    xhr.send(formData);

    // 等待上传完成
    const result = await uploadPromise;
    return result;
  } catch (error) {
    onError(error.message);
    throw error;
  }
};
