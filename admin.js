const { Telegraf, Markup, Scenes, session } = require('telegraf')
const dotenv = require('dotenv')
const { addUser } = require('./db')
const {
	textScene,
	photoScene,
	urlScene,
	urlLinkScene,
	previewScene,
	postponeMailingScene,
} = require('./adminscenes')

// Загружаем переменные окружения из файла .env
dotenv.config()

const bot = new Telegraf(process.env.TOKEN)
// Получаем список администраторов из переменной окружения
const admins = process.env.ADMINS.split(',')

// Создаем менеджер сцен
const stage = new Scenes.Stage([
	textScene,
	photoScene,
	urlScene,
	urlLinkScene,
	previewScene,
	postponeMailingScene,
])

bot.start(ctx => {
	const userId = ctx.from.id
	addUser(userId)
	ctx.reply('Добро пожаловать! Вы были добавлены в базу данных.')
    
})
bot.use(session())
bot.use(stage.middleware())

bot.command('admin', ctx => {
	const userId = ctx.from.id.toString()

	if (admins.includes(userId)) {
		ctx.reply(
			'Вы вошли в админ панель',
			Markup.inlineKeyboard([
				[Markup.button.callback('Рассылка', 'advertisement')],
				[Markup.button.callback('Обязательная подписка ', 'subscription')],
		
			])
		)
	}
})

bot.action(
	[
		'advertisement',
		'add:text',
		'add:photo',
		'skip:text',
		'skip:photo',
		'Cancel',
		'skip:Url',
		'subscription',
		'preview',
	
		'postpone:subscription',
		'postpone:mailing',
	],
	async ctx => {
		const startTime = Date.now() // Начало измерения времени

		try {
			await ctx.answerCbQuery()

			switch (ctx.match[0]) {
                case 'subscription':

                    break
				case 'advertisement':
					await ctx.editMessageText(
						'Выберите действие ',
						Markup.inlineKeyboard([
							[Markup.button.callback('добавить текст ', 'add:text')],
							[Markup.button.callback('Добавить фотографию', 'add:photo')],
							[Markup.button.callback('Отменить', 'Cancel')],
						])
					)
					break
				case 'add:text':
					await ctx.deleteMessage()
					ctx.scene.enter('textScene')
					break
				case 'add:photo':
				case 'skip:text':
					await ctx.deleteMessage()
					ctx.scene.enter('photoScene')
					break
				case 'skip:photo':
					await ctx.deleteMessage()
					ctx.scene.enter('urlScene')
					break
				case 'Cancel':
					await ctx.deleteMessage()
					ctx.scene.leave()
					ctx.reply(
						'Вы вошли в админ панель',
						Markup.inlineKeyboard([
							[Markup.button.callback('Рассылка', 'advertisement')],
							[
								Markup.button.callback(
									'Обязательная подписка ',
									'subscription'
								),
							],
						])
					)
					break
				default:
					await ctx.editMessageText(`Неизвестная команда.`)
			}
		} catch (error) {
			console.error('Ошибка при обработке колбека:', error)
		}

		const endTime = Date.now() // Конец измерения времени
		console.log(`Время выполнения: ${endTime - startTime} мс`) // Логирование времени выполнения
	}
)

bot.launch()
