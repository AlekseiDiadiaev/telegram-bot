import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'
import { removeFile } from './utils.js'
import say from 'say'
import fs from 'fs';

console.log(config.get('TEST_ENV'))

const INITIAL_SESSION = {
    messages: [],
}

// const PRE_TEXT = 'I study English, you will be my interlocutor. Help me improve my English. Talk to me in short sentences.'
const PRE_TEXT = ''

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

bot.on(message('voice'), async ctx => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Сообщени принял. Жду ответ от серера...'))
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)


        const text = await openai.transcription(mp3Path)      
        await ctx.reply(code(`Ваш запрос ${text}`))

        ctx.session.messages.push({role: openai.roles.USER, content: PRE_TEXT + ' ' + text })

        const response = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content })
        
        await ctx.reply(response.content)
       
        say.export(response.content, 'Alex', 0.8, 'hal.wav');

        setTimeout(async () => {
            const audio = fs.readFileSync('hal.wav');
            await ctx.replyWithVoice({ source: audio}); 
            removeFile('./hal.wav')
        } ,1000)         
        console.log(INITIAL_SESSION.messages)
    }   catch (e) {
        console.log('Error while voice message', e.message)
    }
    
})

bot.on(message('text'), async ctx => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Сообщени принял. Жду ответ от серера...'))

        ctx.session.messages.push({
            role: openai.roles.USER, 
            content: PRE_TEXT + ' ' + ctx.message.text
        })

        const response = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content })

        await ctx.reply(response.content)

        say.export(response.content, 'Alex', 0.8, 'hal.wav');

        setTimeout(async () => {
            const audio = fs.readFileSync('hal.wav');
            await ctx.replyWithVoice({ source: audio}); 
            removeFile('./hal.wav')
        } ,1000)     
        console.log(INITIAL_SESSION)                  
    }   catch (e) {
        console.log('Error while voice message', e.message)
    }
    
})



bot.command('start', async (ctx) => {
    await ctx.reply(JSON.stringify(ctx.message, null, 2))
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

