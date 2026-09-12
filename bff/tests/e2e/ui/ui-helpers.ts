import { Page } from '@playwright/test';

/**
 * Внедряет в страницу плавающий баннер с названием текущего теста.
 * Помогает визуально отслеживать прогресс при просмотре видео или скриншотов.
 */
export async function injectTestInfo(page: Page, testTitle: string) {
  await page.evaluate((title) => {
    const banner = document.createElement('div');
    banner.id = 'playwright-test-info';
    banner.innerText = `🧪 Test: ${title}`;
    banner.style.position = 'fixed';
    banner.style.top = '10px';
    banner.style.left = '10px';
    banner.style.zIndex = '9999';
    banner.style.padding = '8px 12px';
    banner.style.backgroundColor = '#ffcc00';
    banner.style.color = '#000';
    banner.style.fontWeight = 'bold';
    banner.style.borderRadius = '8px';
    banner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    banner.style.pointerEvents = 'none';
    banner.style.fontSize = '14px';
    banner.style.fontFamily = 'sans-serif';
    banner.style.border = '2px solid #000';
    document.body.appendChild(banner);
  }, testTitle);
}
