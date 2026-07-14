export interface PluginContent {
    _type: string;
    [key: string]: unknown;
}
export declare const PluginContent: {
    isPluginContent(content: unknown): content is PluginContent;
};
