import {
  Document,
  Font,
  Line,
  Link,
  Page,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import type { Block, Inline } from "@/lib/nda/types";

/**
 * PDF rendering of the agreement. This module pulls in the whole PDF library,
 * so it is only ever loaded with a dynamic `import()` when the user downloads.
 */

// The PDF's built-in fonts only cover Western European characters, so embed
// one that also handles the rest of Latin, Greek and Cyrillic.
const FONT = "Noto Serif";
Font.register({
  family: FONT,
  fonts: [
    { src: "/fonts/NotoSerif-Regular.ttf" },
    { src: "/fonts/NotoSerif-Bold.ttf", fontWeight: "bold" },
  ],
});

// Never split words across lines: hyphenated names and addresses read badly.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 64,
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 1.45,
    color: "#111111",
  },
  h1: { fontWeight: "bold", fontSize: 17, textAlign: "center", marginBottom: 6 },
  h2: { fontWeight: "bold", fontSize: 9, marginTop: 12, letterSpacing: 0.5 },
  h3: { fontWeight: "bold", fontSize: 11, marginTop: 14 },
  hint: { fontFamily: "Helvetica", fontSize: 8, color: "#666666" },
  paragraph: { marginTop: 5 },
  statement: { marginTop: 14 },
  small: { marginTop: 16, fontSize: 8.5, color: "#444444" },
  bold: { fontWeight: "bold" },
  link: { color: "#1d4ed8", textDecoration: "underline" },
  option: { flexDirection: "row", marginTop: 4 },
  checkbox: {
    width: 9,
    height: 9,
    marginTop: 2,
    marginRight: 6,
    borderWidth: 0.75,
    borderColor: "#111111",
  },
  optionText: { flex: 1 },
  clause: { flexDirection: "row", marginTop: 7 },
  clauseNumber: { width: 20 },
  clauseText: { flex: 1, textAlign: "justify" },
  table: { marginTop: 10, borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: "#999999" },
  row: { flexDirection: "row" },
  cell: {
    flex: 3,
    minHeight: 26,
    padding: 5,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: "#999999",
  },
  labelCell: { flex: 2 },
  headerCell: { fontWeight: "bold", textAlign: "center", minHeight: 0 },
  pageNumber: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
  },
});

function Runs({ content }: { content: Inline[] }) {
  return content.map((run, index) => {
    if (run.href) {
      return (
        <Link key={index} src={run.href} style={styles.link}>
          {run.text}
        </Link>
      );
    }
    return (
      <Text key={index} style={run.bold ? styles.bold : undefined}>
        {run.text}
      </Text>
    );
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return (
        <View break={block.pageBreak} minPresenceAhead={40}>
          <Text style={styles[`h${block.level}`]}>{block.text}</Text>
          {block.hint && <Text style={styles.hint}>{block.hint}</Text>}
        </View>
      );
    case "paragraph":
      return (
        <Text style={block.small ? styles.small : styles.paragraph}>
          <Runs content={block.content} />
        </Text>
      );
    case "options":
      return block.options.map((option, index) => (
        <View key={index} style={styles.option} wrap={false}>
          <View style={styles.checkbox}>
            {option.checked && (
              <Svg viewBox="0 0 10 10">
                <Line x1={2} y1={2} x2={8} y2={8} stroke="#111111" strokeWidth={1.5} />
                <Line x1={8} y1={2} x2={2} y2={8} stroke="#111111" strokeWidth={1.5} />
              </Svg>
            )}
          </View>
          <Text style={styles.optionText}>
            <Runs content={option.content} />
          </Text>
        </View>
      ));
    case "clause":
      return (
        <View style={styles.clause}>
          <Text style={styles.clauseNumber}>{block.number}.</Text>
          <Text style={styles.clauseText}>
            <Runs content={block.content} />
          </Text>
        </View>
      );
    case "signatures":
      return (
        <View wrap={false}>
          <Text style={styles.statement}>
            <Runs content={block.statement} />
          </Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell, styles.headerCell]} />
              {block.partyLabels.map((label) => (
                <Text key={label} style={[styles.cell, styles.headerCell]}>
                  {label}
                </Text>
              ))}
            </View>
            {block.rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <View style={[styles.cell, styles.labelCell]}>
                  <Text>{row.label}</Text>
                  {row.hint && <Text style={styles.hint}>{row.hint}</Text>}
                </View>
                {row.values.map((value, index) => (
                  <Text key={index} style={styles.cell}>
                    {value}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
  }
}

function NdaPdf({ blocks, title }: { blocks: Block[]; title: string }) {
  return (
    <Document title={title} creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        {blocks.map((block, index) => (
          <BlockView key={index} block={block} />
        ))}
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

/** Generates the PDF in the browser and saves it to the user's device. */
export async function downloadNdaPdf(blocks: Block[], fileName: string): Promise<void> {
  const title = fileName.replace(/\.pdf$/, "").replaceAll("-", " ");
  const blob = await pdf(<NdaPdf blocks={blocks} title={title} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
