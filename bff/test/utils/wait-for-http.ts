import axios from 'axios';

export async function waitForHttp(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  
  while (true) {
    try {
      await axios.get(url, { timeout: 2000 });
      return; // Успех!
    } catch {
      // Если timeoutMs = 0, ждём бесконечно
      if (timeoutMs > 0 && Date.now() - start >= timeoutMs) {
        throw new Error(`Timeout waiting for ${url} after ${timeoutMs}ms`);
      }
      // Выводим сообщение каждые 5 секунд, чтобы было видно прогресс
      console.log(`⏳ Ожидание ${url}...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
