function reload() {

    if (typeof window === "undefined") return;

    window.addEventListener("message", (event) => {
        if (event.data?.action === 'pageRefresh') {
            window.location.reload();
        }
    })
}

export default reload;