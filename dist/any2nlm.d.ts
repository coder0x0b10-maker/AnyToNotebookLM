export interface Any2NLMOptions {
    url: string;
    notebookId?: string;
    notebookName?: string;
    notebookKeyword?: string;
    notebookMatchMode?: 'exact' | 'contains' | 'regex';
    title?: string;
    outputPath?: string;
    dryRun: boolean;
}
export declare class AnyToNotebookLM {
    private tempFiles;
    run(options: Any2NLMOptions): Promise<void>;
    private extractContent;
    private validateNotebookOptions;
    private resolveNotebookId;
    private fetchNotebookList;
    private parseNotebookList;
    private matchNotebooksByName;
    private matchNotebooksByKeyword;
    private uploadToNotebookLM;
    private writeToFile;
    private deriveTitleFromContent;
    private checkPrerequisite;
    private detectPlatform;
    private extractFromX;
    private extractFromYouTube;
    private extractFromGitHub;
    private extractFromWeb;
    private handleError;
    private cleanup;
}
//# sourceMappingURL=any2nlm.d.ts.map