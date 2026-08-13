import { parse } from 'yaml'
import { compileScene } from './scene.ts'

export const compileYaml = (source: string) => compileScene(parse(source))
