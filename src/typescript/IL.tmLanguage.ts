"use strict";
import { TmLanguage } from "./TMLanguageModel";

export const ilTmLanguage: TmLanguage = {
    fileTypes: [
        'nil'
    ],
    firstLineMatch: '^#!/.*\\b\\w*il\\b',
    foldingStartMarker: '/\\*\\*|\\{\\s*$',
    foldingStopMarker: '\\*\\*/|^\\s*\\}',
    keyEquivalent: '^~S',
    repository: {
        keywords: {
            patterns: [
                {
                    match: '\\b(@|const|fn|if|else|RangeOf|fusion|stackvm|k[0-9]{3})\\b',
                    name: 'keyword.declaration.const.il'
                },
                {
                    match: '\\b(i|u|f)(8|16|32|64)\\b',
                    name: 'support.type.primitive.il'
                },
            ]
        },
        strings: {
            patterns: [
                {
                    match: '".*"',
                    name: 'constant.literal.il'
                }
            ]
        },
        local: {
            patterns: [
                {
                    match: '%[0-9a-zA-Z_]+',
                    name: 'meta.definition.variable.il'
                },
                {
                    begin: " ",
                    match: '\\b[A-Z][A-Za-z1-9_]*\\b',
                    name: 'entity.name.function.il'
                },
            ]
        },
        constants: {
            patterns: [
                {
                    match: '\\b(false|true)\\b',
                    name: 'constant.language.il'
                },
                {
                    match: '\\b(0[xX][0-9a-fA-F_]*)\\b',
                    name: 'constant.numeric.il'
                },
                {
                    match: '\\b(([0-9][0-9_]*(\\.[0-9][0-9_]*)?)([eE](\\+|-)?[0-9][0-9_]*)?|[0-9][0-9_]*)[LlFfDd]?\\b',
                    name: 'constant.numeric.il'
                },
                {
                    match: '(\\.[0-9][0-9_]*)([eE](\\+|-)?[0-9][0-9_]*)?[LlFfDd]?\\b',
                    name: 'constant.numeric.il'
                },
            ]
        },
        code: {
            patterns: [
                {
                    include: '#keywords'
                },
                {
                    include: '#strings'
                },
                {
                    include: '#local'
                },
                {
                    include: '#constants'
                },
            ]
        }
    },
    patterns: [
        {
            include: '#code'
        }
    ],
    name: 'nil',
    scopeName: "source.il",
}