/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments, TextDocument, 
	Diagnostic, DiagnosticSeverity, InitializeResult, TextDocumentPositionParams, CompletionItem, 
	CompletionItemKind
} from 'vscode-languageserver';
import rest from './restCall';
var arrayOfAutocompleteObjects : CompletionItem[] = [];
var mapOfStoryIssuesAndDescription : { [key:string]:string; } = {};

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	console.log('api call');
	rest.getAccessToken().then( (accessToken:any) => {
		console.log(accessToken);
 	Promise.all([rest.fetchProductStories('Appirio DX',accessToken),rest.fetchProductIssues('7-Eleven Info Dispatch',accessToken)]).then((response:any) => {
			for(let i=0; i<response[0].length; i++){
				let autoCompleteObject:any = {};
				autoCompleteObject.label = response[0][i].storyNumber;
				autoCompleteObject.kind = CompletionItemKind.Text;
				autoCompleteObject.data = i;
				autoCompleteObject.detail = response[0][i].description;
                autoCompleteObject.documentation = encodeURI('https://appirio--c.na3.visual.force.com/apex/CMC_StoryView?id='+response[0][i].id+'&sfdc.override=1');
				arrayOfAutocompleteObjects.push(autoCompleteObject);
				mapOfStoryIssuesAndDescription[response[0][i].storyNumber] = response[0][i].description;
			} 
		    
			for(let j=0;j<response[1].length;j++){
				 let autoCompleteObject:any = {};
				 autoCompleteObject.label = response[1][j].issueNumber;
				 autoCompleteObject.kind = CompletionItemKind.Text;
				 autoCompleteObject.detail = response[1][j].title;
				 autoCompleteObject.documentation = encodeURI('https://appirio--c.na3.visual.force.com/apex/CMC_StoryView?id='+response[1][j].id+'&sfdc.override=1');
				 arrayOfAutocompleteObjects.push(autoCompleteObject);
				 mapOfStoryIssuesAndDescription[response[1][j].issueNumber] = response[1][j].title;
			}
			console.log(arrayOfAutocompleteObjects);
			documents.all().forEach(validateTextDocument);
			console.log(JSON.stringify(response[0]));
	}).catch(function (err:any) {
		connection.console.log(JSON.stringify(err));
	})
	}).catch(function (err:any) { 
		connection.console.log(JSON.stringify(err));
	})
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document);
});

// The settings interface describe the server relevant settings part
interface Settings {
	lspSample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.lspSample.maxNumberOfProblems || 100;
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	let lines = textDocument.getText().split(/\r?\n/g);
	let problems = 0;
	let re = /S-|I-/g;
	for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
		var arrayOfStoryAndIssueNumbers : number[] = [];
		let line = lines[i];
		var match;
		//let index = line.indexOf('typescript');
		while ((match = re.exec(line)) != null) {
		arrayOfStoryAndIssueNumbers.push(match.index);
		console.log(match);
	}
	
	for(let j=0;j<arrayOfStoryAndIssueNumbers.length;j++){
				if (arrayOfStoryAndIssueNumbers.length >= 0) {
			//problems++;
			if(mapOfStoryIssuesAndDescription[line.substring(arrayOfStoryAndIssueNumbers[j], arrayOfStoryAndIssueNumbers[j]+8)]!=undefined){
				diagnostics.push({
					severity: DiagnosticSeverity.Information,
					range: {
						start: { line: i, character: arrayOfStoryAndIssueNumbers[j] },
						end: { line: i, character: arrayOfStoryAndIssueNumbers[j] + 8 }
					},
					message:JSON.stringify(mapOfStoryIssuesAndDescription[line.substring(arrayOfStoryAndIssueNumbers[j], arrayOfStoryAndIssueNumbers[j]+8)]),
					source: 'Appirio'
				});
			}
			}
			
	}

	}
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We recevied an file change event');
});


// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in 
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	return arrayOfAutocompleteObjects;
});

// This handler resolve additional information for the item selected in
// the completion list.

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    // connection.console.log(arrayOfAutocompleteObjects[item.data]);
	//  if (item.data === 1) {
	// / 	item.detail = 'TypeScript details',
	// 		item.documentation = 'TypeScript documentation'
	// } else if (item.data === 2) {
	// 	item.detail = 'JavaScript details',
	// 		item.documentation = 'JavaScript documentation'
	// }
	return item;
});

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();
