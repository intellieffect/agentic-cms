import {
    BaseBlockquotePlugin,
    BaseH1Plugin,
    BaseH2Plugin,
    BaseH3Plugin,
    BaseHorizontalRulePlugin,
} from '@platejs/basic-nodes';
import {BaseParagraphPlugin} from 'platejs';

export const BaseBasicBlocksKit = [
    BaseParagraphPlugin,
    BaseH1Plugin,
    BaseH2Plugin,
    BaseH3Plugin,
    BaseBlockquotePlugin,
    BaseHorizontalRulePlugin,
];
