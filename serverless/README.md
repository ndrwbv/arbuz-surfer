# API пожеланий и рейтинга (Yandex Cloud)

Сайт статический (GitHub Pages), поэтому браузер не пишет в бакет сам — права были бы у каждого игрока.
Схема: **браузер → Cloud Function → Object Storage**. Права на бакет есть только у сервисного аккаунта функции.

```
игра (ndrwbv.github.io)  ──GET/POST──►  Cloud Function arbuz-api  ──S3 API──►  бакет arbuz-surfer-data
                                         (публичный вызов)                       wishes/<id>.json
                                                                                  scores/<player>.json
```

## Что создать

Всё в **личном** облаке (`cloud-ndrwbv`, каталог `default`). Ключей и секретов нет: функция работает от
сервисного аккаунта, и Yandex сам передаёт ей временный IAM-токен.

1. **Бакет** `arbuz-surfer-data`: приватный, все три пункта доступа «С авторизацией».
2. **Сервисный аккаунт** `arbuz-surfer` с ролью `storage.editor` на каталог.
3. **Функция** `arbuz-api` (Cloud Functions → «Создать функцию»), в редакторе:
   - среда выполнения — свежая `nodejs`, способ загрузки «ZIP-архив», файл `arbuz-api.zip` (собирается так:
     `cd serverless && zip -r ../arbuz-api.zip index.js package.json`);
   - точка входа `index.handler`, таймаут 10 с, память 128 МБ;
   - **сервисный аккаунт** `arbuz-surfer` — без него функция ответит «no service account token»;
   - переменные окружения: `BUCKET=arbuz-surfer-data`, `ALLOW_ORIGIN=https://ndrwbv.github.io`;
   - «Сохранить изменения», на обзоре функции включить «Публичная функция».
4. **Включить в игре** — вписать ссылку функции в [`js/config.js`](../js/config.js), закоммитить, запушить:
   ```js
   window.ARBUZ_API = 'https://functions.yandexcloud.net/<FUNCTION_ID>';
   ```

Проверка:
```bash
curl 'https://functions.yandexcloud.net/<FUNCTION_ID>?op=wishes'
curl -X POST 'https://functions.yandexcloud.net/<FUNCTION_ID>?op=wish' -d '{"name":"Тест","text":"С днём рождения!"}'
```

## Что важно знать

- **Пожелания попадают в игру без модерации.** Неудачное удаляется объектом из бакета
  (`yc storage s3api delete-object --bucket arbuz-surfer-data --key wishes/<id>.json`).
- **Рейтинг честный, пока никто не захочет обмануть**: очки считает браузер, функция лишь проверяет диапазон.
- Стоимость — копейки: бакет на килобайты, функция вызывается несколько раз за игру.
- Если `ARBUZ_API` пустой или функция недоступна, игра работает офлайн: рейтинг локальный, пожелания встроенные.
