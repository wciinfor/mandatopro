path = "src/pages/solicitacoes/index.js"
with open(path, "rb") as f:
    raw = f.read()
text = raw.decode("utf-8")
SEP = "\r\n\r\n\r\n"
if "podeCriar" in text:
    print("podeCriar already present")
else:
    look = "const getUsuario"
    idx = text.find(look)
    if idx >= 0:
        end_fn = text.find("  };", idx) + 4
        insert_at = end_fn
        text = text[:insert_at] + "\r\n\r\n  const podeCriar = [\"ADMINISTRADOR\", \"LIDERANCA\"].includes(getUsuario()?.nivel);" + text[insert_at:]
        print("podeCriar added at index", insert_at)
    else:
        print("WARN getUsuario not found")
if "podeCriar" in text:
    btn_idx = text.find("setShowNova(true)")
    if btn_idx >= 0:
        btn_start = text.rfind("<button", 0, btn_idx)
        btn_end = text.find("</button>", btn_idx) + 9
        old_btn = text[btn_start:btn_end]
        if "{podeCriar" not in old_btn:
            new_btn = "{podeCriar && (\r\n            " + old_btn + "\r\n            )}"
            text = text[:btn_start] + new_btn + text[btn_end:]
            print("button wrapped")
        else:
            print("button already wrapped")
with open(path, "wb") as f:
    f.write(text.encode("utf-8"))
print("done")
