function Table({ columns = [], rows = [], emptyMessage = 'No data available' }) {
  if (!rows.length) {
    return (
      <section className="card">
        <p className="muted">{emptyMessage}</p>
      </section>
    )
  }

  const hasActionColumn = columns.some((column) => column.key === '__actions')
  const mergedColumns = hasActionColumn
    ? columns
    : [...columns, { key: '__actions', label: 'Actions' }]

  return (
    <section className="card table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {mergedColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.id ?? rowIndex}`}>
              {mergedColumns.map((column) => (
                <td key={`${row.id ?? rowIndex}-${column.key}`}>
                  {column.key === '__actions' ? (
                    <button type="button" className="meatball" aria-label="Actions">
                      ...
                    </button>
                  ) : column.render ? (
                    column.render(row[column.key], row)
                  ) : (
                    row[column.key] ?? '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default Table
