import {useEffect,useRef} from 'react';
import Phaser from 'phaser';
import {GameScene, type GameCommand} from '../game/GameScene';
export default function PhaserGame({command,serial}:{command:GameCommand;serial:number}){
 const mount=useRef<HTMLDivElement>(null),game=useRef<Phaser.Game|null>(null),scene=useRef<GameScene|null>(null);
 useEffect(()=>{if(!mount.current)return;const s=new GameScene();scene.current=s;game.current=new Phaser.Game({type:Phaser.AUTO,parent:mount.current,width:800,height:360,transparent:false,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[s],render:{pixelArt:false,antialias:true}});return()=>{game.current?.destroy(true);game.current=null;scene.current=null}},[]);
 useEffect(()=>{if(serial>0&&scene.current?.sys.isActive())scene.current.command(command)},[serial,command]);
 return <div className="phaser-mount" ref={mount}/>;
}
