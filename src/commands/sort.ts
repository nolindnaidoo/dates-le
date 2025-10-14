import * as vscode from 'vscode'

export function registerSortCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('dates-le.postProcess.sort', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found')
      return
    }

    // Prompt user for sort order
    const sortOrder = await vscode.window.showQuickPick(
      [
        { label: 'Chronological (Oldest First)', value: 'asc' },
        { label: 'Reverse Chronological (Newest First)', value: 'desc' },
        { label: 'Alphabetical (A → Z)', value: 'alpha-asc' },
        { label: 'Alphabetical (Z → A)', value: 'alpha-desc' },
      ],
      { placeHolder: 'Select sort order' },
    )

    if (!sortOrder) {
      return // User cancelled
    }

    try {
      const document = editor.document
      const text = document.getText()
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      let sorted: string[]
      if (sortOrder.value === 'asc' || sortOrder.value === 'desc') {
        // Try to parse as dates and sort chronologically
        const datesWithOriginal = lines.map((line) => ({
          original: line,
          date: new Date(line),
        }))

        sorted = datesWithOriginal
          .sort((a, b) => {
            const aTime = a.date.getTime()
            const bTime = b.date.getTime()
            // Handle invalid dates by putting them at the end
            if (isNaN(aTime) && isNaN(bTime)) return 0
            if (isNaN(aTime)) return 1
            if (isNaN(bTime)) return -1
            return sortOrder.value === 'asc' ? aTime - bTime : bTime - aTime
          })
          .map((item) => item.original)
      } else {
        // Alphabetical sort
        sorted = [...lines].sort((a, b) => {
          return sortOrder.value === 'alpha-asc' ? a.localeCompare(b) : b.localeCompare(a)
        })
      }

      // Replace document content
      const edit = new vscode.WorkspaceEdit()
      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), sorted.join('\n'))
      await vscode.workspace.applyEdit(edit)

      vscode.window.showInformationMessage(`Sorted ${sorted.length} dates (${sortOrder.label})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      vscode.window.showErrorMessage(`Sorting failed: ${message}`)
    }
  })

  context.subscriptions.push(command)
}
