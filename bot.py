import asyncio
import logging
import sqlite3
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# --- НАСТРОЙКИ (Замени на свои данные) ---
TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
WEBAPP_URL = "https://YOUR_USERNAME.github.io/YOUR_REPO/" # Ссылка на GitHub Pages
ADMIN_IDS = [123456789] # Вставь свой Telegram ID

# --- ИНИЦИАЛИЗА БД ---
def init_db():
    with sqlite3.connect("bot_database.db") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def add_user(user_id: int, username: str, first_name: str):
    with sqlite3.connect("bot_database.db") as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO users (user_id, username, first_name) VALUES (?, ?, ?)",
            (user_id, username, first_name)
        )
        conn.commit()

def get_stats():
    with sqlite3.connect("bot_database.db") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        total = cursor.fetchone()[0]
        return total

def get_all_user_ids():
    with sqlite3.connect("bot_database.db") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users")
        return [row[0] for row in cursor.fetchall()]

# --- FSM ДЛЯ РАССЫЛКИ ---
class BroadcastState(StatesGroup):
    waiting_for_message = State()

# --- ИНИЦИАЛИЗА БОТА ---
bot = Bot(token=TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# --- КЛАВИАТУРЫ ---
def get_main_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📐 Открыть Looksmax HARM 49", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="ℹ️ Как пользователем", callback_data="help_info")]
    ])

# --- ХЕНДЛЕРЫ ---
@dp.message(CommandStart())
async def cmd_start(message: Message):
    add_user(message.from_user.id, message.from_user.username, message.from_user.first_name)
    welcome_text = (
        f"Привет, <b>{message.from_user.first_name}</b>!\n\n"
        "Добро пожаловать в **Looksmax HARM 49 Analyzer**.\n"
        "Этот инструмент позволяет провести биометрический анализ пропорций лица по 49 ключевым точкам.\n\n"
        "Нажми кнопку ниже, чтобы загрузить фото и рассчитать свой индекс:"
    )
    await message.answer(welcome_text, parse_mode="HTML", reply_markup=get_main_kb())

@dp.callback_query(F.data == "help_info")
async def cb_help(call):
    help_text = (
        "<b>Инструкция по замеру:</b>\n\n"
        "1. Загрузи четкое фото лица ровно в анфас (без наклонов и поворотов).\n"
        "2. Поочередно отметь 49 точек согласно подсказкам в верхней панели.\n"
        "3. Ошибся? Используй кнопку ↩ для отмены последней точки.\n"
        "4. После установки всех 49 точек нажми «Посчитать индекс HARM»."
    )
    await call.message.answer(help_text, parse_mode="HTML", reply_markup=get_main_kb())
    await call.answer()

# --- АДМИН-ПАНЕЛЬ ---
@dp.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    total_users = get_stats()
    admin_text = (
        "⚙️ <b>Панель администратора</b>\n\n"
        f"👥 Всего пользователей: <code>{total_users}</code>\n\n"
        "Команды:\n"
        "/stats — Обновить статистику\n"
        "/broadcast — Запустить рассылку"
    )
    await message.answer(admin_text, parse_mode="HTML")

@dp.message(Command("stats"))
async def cmd_stats(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    total_users = get_stats()
    await message.answer(f"📊 Пользователей в базе: <b>{total_users}</b>", parse_mode="HTML")

@dp.message(Command("broadcast"))
async def cmd_broadcast(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    await message.answer("Отправь сообщение (текст, фото, медиа), которое нужно разослать всем пользователям:")
    await state.set_state(BroadcastState.waiting_for_message)

@dp.message(BroadcastState.waiting_for_message)
async def process_broadcast(message: Message, state: FSMContext):
    await state.clear()
    users = get_all_user_ids()
    await message.answer(f"🚀 Начинаю рассылку на {len(users)} пользователей...")
    
    success, failed = 0, 0
    for uid in users:
        try:
            await message.copy_to(chat_id=uid)
            success += 1
            await asyncio.sleep(0.05)
        except Exception:
            failed += 1

    await message.answer(
        f"✅ <b>Рассылка завершена!</b>\n\n"
        f"Успешно: {success}\n"
        f"Ошибок (заблокировали бота): {failed}",
        parse_mode="HTML"
    )

# --- ЗАПУСК ---
async def main():
    logging.basicConfig(level=logging.INFO)
    init_db()
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
