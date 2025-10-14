import * as vscode from 'vscode'
import * as nls from 'vscode-nls'
import { getConfiguration } from '../config/config'
import { extractDates } from '../extraction/extract'
import { showProgress } from '../utils/progress'
import { sortDates } from '../utils/sort'

const localize = nls.config({ messageFormat: nls.MessageFormat.file })()

export async function sortDatesCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showWarningMessage(localize('runtime.sort.no-editor', 'No active editor found'))
    return
  }

  const document = editor.document
  const content = document.getText()
  const languageId = document.languageId

  if (!content.trim()) {
    vscode.window.showWarningMessage(localize('runtime.sort.empty', 'Document is empty'))
    return
  }

  const _config = getConfiguration()

  try {
    await showProgress(localize('runtime.sort.progress', 'Sorting dates...'), async () => {
      const result = await extractDates(content, languageId)

      if (result.dates.length === 0) {
        vscode.window.showInformationMessage(
          localize('runtime.sort.no-dates', 'No dates found to sort'),
        )
        return
      }

      const sortedDates = sortDates([...result.dates], 'chronological')

      // Create a new document with sorted dates
      const sortedContent = sortedDates
        .map((date) => `${date.value} - ${date.context || 'Extracted date'}`)
        .join('\n')

      // Open a new document with sorted results
      const doc = await vscode.workspace.openTextDocument({
        content: sortedContent,
        language: 'plaintext',
      })

      await vscode.window.showTextDocument(doc)

      vscode.window.showInformationMessage(
        localize('runtime.sort.success', 'Sorted {0} dates chronologically', sortedDates.length),
      )
    })
  } catch (error) {
    console.error('[Dates-LE] Sort command error:', error)
    vscode.window.showErrorMessage(
      localize(
        'runtime.sort.error',
        'Failed to sort dates: {0}',
        error instanceof Error ? error.message : 'Unknown error',
      ),
    )
  }
}
