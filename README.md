# Волк ловит яйца — HTML5-игра для Telegram Mini App и GitHub Pages

Готовый статический проект: можно загрузить на GitHub Pages и использовать URL как Telegram Mini App / Web App.

## Состав архива

```text
index.html
assets/README.md
.nojekyll
```

## Быстрая публикация на GitHub Pages

1. Создайте репозиторий на GitHub, например `wolf-game`.
2. Распакуйте архив.
3. Загрузите файлы в корень репозитория:
   - `index.html`
   - `.nojekyll`
   - папку `assets`
4. Откройте репозиторий → `Settings` → `Pages`.
5. В блоке `Build and deployment` выберите:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/root`
6. После публикации игра будет доступна по адресу вида:

```text
https://ВАШ_ЛОГИН.github.io/wolf-game/
```

## Подключение в Telegram

1. Откройте `@BotFather`.
2. Создайте бота командой `/newbot`, если бот ещё не создан.
3. Настройте кнопку запуска:
   - `/mybots`
   - выберите бота
   - `Bot Settings`
   - `Menu Button`
   - `Configure menu button`
4. Укажите:
   - текст кнопки: `Играть`
   - URL: `https://ВАШ_ЛОГИН.github.io/wolf-game/`

## Свои изображение и звуки

Оригинальные изображения и звуки мультфильма не включены в архив.

Если у вас есть права на собственные файлы, положите их в папку `assets`:

```text
assets/wolf.png
assets/sound-start.mp3
assets/sound-catch.mp3
assets/sound-miss.mp3
assets/sound-gameover.mp3
```

Затем в `index.html` измените настройки:

```js
const USE_EXTERNAL_WOLF_IMAGE = true;
const USE_EXTERNAL_SOUNDS = true;
```

Если эти флаги оставить `false`, игра работает без внешних файлов: волк рисуется средствами Canvas, звуки генерируются через WebAudio.

## Проверка локально

Можно открыть `index.html` двойным кликом в браузере. Для максимально корректной проверки запустите локальный сервер:

```bash
python3 -m http.server 8080
```

И откройте:

```text
http://localhost:8080/
```
