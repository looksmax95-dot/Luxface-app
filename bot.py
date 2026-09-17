import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

TOKEN = "8692262547:AAGBS_ztQFOIz2JmBYv-2EVMND1OTmvBAus"
# Вставь сюда свою ссылку на GitHub Pages (например, https://username.github.io/looksmax_bot/)
WEB_APP_URL = "https://github.com/looksmax95-dot/Luxface-app"

bot = telebot.TeleBot(TOKEN)
bot.remove_webhook()

@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton(text="📐 Пройти оценку пропорций", web_app=WebAppInfo(url=WEB_APP_URL)))
    
    text = (
        f"Привет, {message.from_user.first_name}!\n\n"
        "Добро пожаловать в **Looksmax Harmony Calculator**.\n"
        "Нажми кнопку ниже для расстановки точек и получения отчета HARM."
    )
    bot.send_message(message.chat.id, text, parse_mode="Markdown", reply_markup=markup)

if __name__ == '__main__':
    print("🚀 Бот запущен!")
    bot.infinity_polling(skip_pending=True)
