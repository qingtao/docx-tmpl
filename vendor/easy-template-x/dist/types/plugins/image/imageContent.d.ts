import { MimeType } from '../../mimeType';
import { Binary } from '../../utils';
import { PluginContent } from '../pluginContent';
export type ImageFormat = typeof MimeType.Jpeg | typeof MimeType.Png | typeof MimeType.Gif | typeof MimeType.Bmp | typeof MimeType.Svg;
export interface ImageContent extends PluginContent {
    _type: 'image';
    source: Binary;
    format: ImageFormat;
    width?: number;
    height?: number;
    altText?: string;
    transparencyPercent?: number;
}
