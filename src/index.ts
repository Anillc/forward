//@ts-
import {Context, Model, Channel, segment, Session,Observed} from 'koishi';

declare module 'koishi'{
    interface Channel{
        forward:Array<string>,
    }
}

async function initDB(ctx:Context){
    const extOpt:Model.Field.Extension={
        forward:'list'
    }
    ctx.model.extend('channel',extOpt);
}

// @ts-expect-error
let channels:Pick<Channel, string>[];

async function updateChannels(ctx:Context){
    channels=await ctx.database.getAssignedChannels(['id','forward']);
}

function ignore(text:string){
    const seg=segment.parse(text);
    if(seg[0].data.content.startsWith('//')) return true;
    const isa:boolean=seg[0].type=='quote';
    const isb:boolean=seg[2].data.content.trim().startsWith('//');
    const is=isa && isb;
    return is;
}

const mid=(ctx:Context)=>(session:Session,next: () => void)=>{
    const content:string=session.content as string;
    let forward:string;
    if(!session.channelId || ignore(content)) return next();
    try{
        const rn=channels.find((n)=>n.id==`${session.platform}:${session.channelId}`);
        // @ts-expect-error
        forward=rn.forward;
    }catch(e){
        updateChannels(ctx);
        return next();
    }
    //@ts-expect-error
    ctx.broadcast(forward+`${session.author.username}: ${content}`);
    next();
}

const name='forward-cli';

async function apply(ctx:Context){
    ctx.on('ready',async ()=>{
        await initDB(ctx);
        await updateChannels(ctx);
        ctx.middleware(mid(ctx));
        const cmd=ctx.command('forward <to>',{authority:2});
        cmd.option('remove','-r 删除转发')
            .action(({session,options},to)=>{
                // @ts-expect-error
                const chn=session.channel as Observed<Channel>;
                const forward=chn.forward;
                if(!to) return '缺少必要参数';
                const i=forward.indexOf(to);
                // @ts-expect-error
                if(options.remove){
                    if(i==-1) return '没有转发到该频道的记录';
                    forward.splice(i,1);
                    return '删除成功！请使用forward.update更新'
                }
                if(i>=0) return '已经存在记录';
                forward.push(to);
                return '添加成功！，请使用forward.update更新'
            })
        cmd.subcommand('.list',{authority:2})
            .channelFields(['forward'])
            .action(({session})=>{
                // @ts-expect-error
                const chn=session.channel as Observed<Channel>;
                const forward=chn.forward;
                return JSON.stringify(forward);
            })
        cmd.subcommand('.info',{authority:2})
            .action(({session})=>{
                // @ts-expect-error
                return session.channelId;
            })
        cmd.subcommand('.update',{authority:2})
            .action(async ()=>{
                await updateChannels(ctx);
                return '更新成功！';
            })
    })
}

export {name,apply};