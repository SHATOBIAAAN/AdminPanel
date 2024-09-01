const { Scenes, Markup } = require('telegraf')
const { getUsers } = require('./db')
const textScene = new Scenes.BaseScene('textScene')
textScene.enter(ctx => {
	ctx.reply(
		`Хорошо, отправь текст для рассылки ✒️
Можно использовать стандартную разметку ✂️`,
		Markup.inlineKeyboard([
			[Markup.button.callback('Пропустить', 'skip:text')],
			[Markup.button.callback('Отменить', 'Cancel')],
		])
	)
})
textScene.on('text', ctx => {
	ctx.session.text = ctx.message.text
	ctx.scene.enter('photoScene')
})
textScene.action('skip:text', async ctx => {
	ctx.session.text = null
	await ctx.deleteMessage()
	ctx.scene.enter('photoScene')
})

const photoScene = new Scenes.BaseScene('photoScene')
photoScene.enter(ctx => {
	ctx.reply(
		`Отправь фотографию или нажми "Пропустить", чтобы продолжить без фото`,
		Markup.inlineKeyboard([
			[Markup.button.callback('Пропустить', 'skip:photo')],
			[Markup.button.callback('Отменить', 'Cancel')],
		])
	)
})
photoScene.on('photo', ctx => {
	ctx.session.photo = ctx.message.photo
	ctx.scene.enter('urlScene')
})
photoScene.action('skip:photo', async ctx => {
	ctx.session.photo = null
	await ctx.deleteMessage()
	ctx.scene.enter('urlScene')
})

const urlScene = new Scenes.BaseScene('urlScene')
urlScene.enter(ctx => {
	ctx.reply(
		`Теперь отправь текст для кнопки URL`,
		Markup.inlineKeyboard([
			[Markup.button.callback('Пропустить', 'skip:url')],
			[Markup.button.callback('Отменить', 'Cancel')],
		])
	)
})
urlScene.on('text', ctx => {
	ctx.session.urlButtonText = ctx.message.text
	ctx.reply('Теперь отправь ссылку для кнопки')
	ctx.scene.enter('urlLinkScene')
})
urlScene.action('skip:url', async ctx => {
	ctx.session.urlButtonText = null
	ctx.session.urlButtonLink = null
	await ctx.deleteMessage()
	ctx.scene.enter('previewScene')
})

const urlLinkScene = new Scenes.BaseScene('urlLinkScene')
urlLinkScene.on('text', ctx => {
	const urlPattern = new RegExp(
		'^(https?:\\/\\/)?' + // protocol
			'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
			'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
			'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
			'(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
			'(\\#[-a-z\\d_]*)?$',
		'i'
	) // fragment locator
	if (!urlPattern.test(ctx.message.text)) {
		return ctx.reply('Пожалуйста, отправьте действительную ссылку.')
	}
	ctx.session.urlButtonLink = ctx.message.text
	ctx.scene.enter('previewScene')
})

const previewScene = new Scenes.BaseScene('previewScene')
previewScene.enter(async ctx => {
	const { text, photo, urlButtonText, urlButtonLink } = ctx.session
	let message = ''
	let extra = {}

	if (text) {
		message += `${text}\n`
	}

	if (urlButtonText && urlButtonLink) {
		extra = {
			...extra,
			...Markup.inlineKeyboard([
				[Markup.button.url(urlButtonText, urlButtonLink)],
			]),
		}
	}

	if (photo) {
		await ctx.replyWithPhoto(photo[photo.length - 1].file_id, {
			caption: message || ' ', // Используем пробел, если message пустое
			...extra,
		})
	} else if (message.trim()) {
		await ctx.reply(message, extra)
	} else {
		await ctx.reply(
			'Сообщение не может быть пустым. Пожалуйста, введите текст.'
		)
		return ctx.scene.enter('textScene')
	}

	await ctx.reply(
		'Выберите действие:',
		Markup.inlineKeyboard([
			[Markup.button.callback('Добавить еще кнопку', 'Add:button')],
			[Markup.button.callback('Отложить', 'Postpone')],
			[Markup.button.callback('Отправить', 'send')],
			[Markup.button.callback('Отменить', 'Cancel')],
		])
	)
})
previewScene.action('Add:button', ctx => {})
previewScene.action('Postpone', async ctx => {
	await ctx.deleteMessage()
	ctx.scene.enter('postponeMailingScene')
})
previewScene.action('send', async ctx => {
	const { text, photo, urlButtonText, urlButtonLink } = ctx.session
	let message = ''
	let extra = {}

	if (text) {
		message += `${text}\n`
	}

	if (urlButtonText && urlButtonLink) {
		extra = {
			...extra,
			...Markup.inlineKeyboard([
				[Markup.button.url(urlButtonText, urlButtonLink)],
				[Markup.button.url(urlButtonText, urlButtonLink)],
			]),
		}
	}

	getUsers(async userIds => {
		for (const userId of userIds) {
			try {
				if (photo) {
					await ctx.telegram.sendPhoto(
						userId,
						photo[photo.length - 1].file_id,
						{
							caption: message,
							...extra,
						}
					)
				} else {
					await ctx.telegram.sendMessage(userId, message, extra)
				}
			} catch (error) {
				console.error(
					`Не удалось отправить сообщение пользователю ${userId}:`,
					error
				)
			}
		}
	})

	ctx.deleteMessage()
	ctx.reply('Реклама отправлена всем пользователям!')
	ctx.scene.leave()
})

previewScene.action('Cancel', ctx => {
	ctx.deleteMessage()
	ctx.reply(
		'Вы вошли в админ панель',
		Markup.inlineKeyboard([
			[Markup.button.callback('Рассылка', 'advertisement')],
			[Markup.button.callback('Обязательная подписка ', 'subscription')],
		])
	)
	ctx.scene.leave()
})
const postponeMailingScene = new Scenes.BaseScene('postponeMailingScene')
postponeMailingScene.enter(ctx => {
	ctx.replyWithHTML(
		'Введите дату и время в формате DD.MM.YYYY HH:MM\n\nПример:\n<blockquote>30.01.2025 18:00</blockquote>',
		Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'Cancel')]])
	)
})

postponeMailingScene.on('text', ctx => {
	const input = ctx.message.text
	const dateTimeRegex = /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/

	if (dateTimeRegex.test(input)) {
		const [date, time] = input.split(' ')
		const [day, month, year] = date.split('.')
		const [hours, minutes] = time.split(':')

		const postponeDate = new Date(year, month - 1, day, hours, minutes)

		if (postponeDate > new Date()) {
			ctx.session.postponeDate = postponeDate
			ctx.reply(`Рассылка отложена до ${postponeDate.toLocaleString()}`)
		} else {
			ctx.reply('Дата и время должны быть в будущем. Попробуйте снова.')
		}
	} else {
		ctx.reply(
			'Неверный формат. Введите дату и время в формате DD.MM.YYYY HH:MM'
		)
	}
	ctx.scene.leave()
})

module.exports = {
	textScene,
	photoScene,
	urlScene,
	urlLinkScene,
	previewScene,
	postponeMailingScene,
}
