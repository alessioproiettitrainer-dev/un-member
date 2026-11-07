// App iPhone di UN-MEMBER: apre l'app web (https://un-member.onrender.com/?app=ios) a schermo intero
// e aggiunge le cose "native": notifiche Apple, link esterni nel browser, permesso fotocamera per il Quality Test.
// Il sito con ?app=ios nasconde prezzi e link di pagamento (regole di Apple).
import UIKit
import WebKit
import UserNotifications

let HOST = "un-member.onrender.com"
let START = URL(string: "https://\(HOST)/?app=ios#/")!
let DARK = UIColor(red: 12 / 255, green: 12 / 255, blue: 14 / 255, alpha: 1)

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // aperta toccando una notifica: dopo il caricamento va alla pagina giusta (es. la chat)
        if let n = launchOptions?[.remoteNotification] as? [AnyHashable: Any], let url = n["url"] as? String {
            WebVC.shared.pendingPath = url
        }
        return true
    }

    // iOS 27: le app devono usare le "scene"; la finestra la crea SceneDelegate
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let c = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
        c.delegateClass = SceneDelegate.self
        return c
    }

    // token Apple del telefono: lo passo all'app web, che lo manda al server
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        WebVC.shared.pushResult(["token": deviceToken.map { String(format: "%02x", $0) }.joined()])
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        WebVC.shared.pushResult(["error": error.localizedDescription])
    }

    // notifica che arriva con l'app aperta: si mostra lo stesso
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    // tocco sulla notifica: apro la pagina indicata (allenamento di oggi, chat…)
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        if let url = response.notification.request.content.userInfo["url"] as? String { WebVC.shared.open(path: url) }
        completionHandler()
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        // aperta toccando una notifica a app chiusa: dopo il caricamento va alla pagina giusta
        if let r = connectionOptions.notificationResponse,
           let url = r.notification.request.content.userInfo["url"] as? String {
            WebVC.shared.pendingPath = url
        }
        let w = UIWindow(windowScene: ws)
        w.backgroundColor = DARK
        w.rootViewController = WebVC.shared
        w.makeKeyAndVisible()
        window = w
    }
}

final class WebVC: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    static let shared = WebVC()
    private var web: WKWebView!
    private var loadedOnce = false
    var pendingPath: String?
    private let errorView = UIView()

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true                 // video degli esercizi dentro la pagina, non a schermo intero
        cfg.mediaTypesRequiringUserActionForPlayback = []    // i video partono da soli, come sul sito
        cfg.websiteDataStore = .default()                    // login e impostazioni restano salvati
        cfg.applicationNameForUserAgent = "UNMEMBER-iOS"
        cfg.userContentController.add(self, name: "unmember") // "ponte" per le notifiche (vedi iosAsk in public/app.js)

        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = DARK
        web.scrollView.backgroundColor = DARK
        web.scrollView.bounces = false
        if #available(iOS 16.4, *) { web.isInspectable = true }

        let root = UIView()
        root.backgroundColor = DARK
        web.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(web)
        // dentro la zona sicura: niente contenuti sotto la tacca o la barra in basso
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor),
        ])
        buildErrorView(in: root)
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: START))
    }

    // ---- schermata "niente connessione" con il tasto Riprova
    private func buildErrorView(in root: UIView) {
        errorView.backgroundColor = DARK
        errorView.isHidden = true
        errorView.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel()
        label.text = "Non riesco a collegarmi.\nControlla la connessione e riprova."
        label.textColor = .white
        label.numberOfLines = 0
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 17, weight: .semibold)
        let button = UIButton(type: .system)
        button.setTitle("Riprova", for: .normal)
        button.setTitleColor(UIColor(red: 26 / 255, green: 12 / 255, blue: 0, alpha: 1), for: .normal)
        button.backgroundColor = UIColor(red: 1, green: 122 / 255, blue: 0, alpha: 1)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .heavy)
        button.layer.cornerRadius = 14
        button.contentEdgeInsets = UIEdgeInsets(top: 14, left: 36, bottom: 14, right: 36)
        button.addTarget(self, action: #selector(retry), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [label, button])
        stack.axis = .vertical
        stack.spacing = 20
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        errorView.addSubview(stack)
        root.addSubview(errorView)
        NSLayoutConstraint.activate([
            errorView.topAnchor.constraint(equalTo: root.topAnchor),
            errorView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            errorView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            stack.centerXAnchor.constraint(equalTo: errorView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: errorView.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: errorView.leadingAnchor, constant: 24),
        ])
    }

    @objc private func retry() {
        errorView.isHidden = true
        if web.url == nil { web.load(URLRequest(url: START)) } else { web.reload() }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { errorView.isHidden = false }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        errorView.isHidden = true
        loadedOnce = true
        if let p = pendingPath { pendingPath = nil; open(path: p) }
    }

    // ---- apre una pagina dell'app (es. "/#/chat/dm-123") da una notifica
    func open(path: String) {
        guard loadedOnce, web.url?.host == HOST else { pendingPath = path; return }
        let hash = path.components(separatedBy: "#").dropFirst().joined(separator: "#")
        let js = "location.hash = \(jsString("#" + hash))"
        web.evaluateJavaScript(js, completionHandler: nil)
    }

    private func jsString(_ s: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [s])) ?? Data("[\"\"]".utf8)
        let arr = String(data: data, encoding: .utf8) ?? "[\"\"]"
        return String(arr.dropFirst().dropLast())
    }

    // ---- link: le pagine dell'app restano qui, tutto il resto (email, YouTube, siti) si apre fuori
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "about" || scheme == "blob" || scheme == "data" { return decisionHandler(.allow) }
        if (scheme == "https" || scheme == "http") && url.host == HOST { return decisionHandler(.allow) }
        // iframe incorporati (es. video dei consigli): restano nella pagina
        if navigationAction.targetFrame != nil && navigationAction.targetFrame?.isMainFrame == false { return decisionHandler(.allow) }
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    // link con target="_blank": le pagine dell'app nella stessa vista, il resto fuori
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if url.host == HOST { webView.load(URLRequest(url: url)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    // fotocamera per il Quality Test: solo per il nostro sito (iOS chiede comunque il permesso la prima volta)
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == HOST ? .grant : .deny)
    }

    // finestre alert/confirm della pagina (es. "Eliminare questo test?")
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Annulla", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Annulla", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }

    // ---- notifiche: messaggi dalla pagina { push: "status" | "enable" }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let what = body["push"] as? String else { return }
        let center = UNUserNotificationCenter.current()
        if what == "status" {
            center.getNotificationSettings { s in
                self.pushResult(["granted": s.authorizationStatus == .authorized || s.authorizationStatus == .provisional])
            }
            return
        }
        // "enable": chiede il permesso (la prima volta compare la finestra di iOS) e registra il telefono
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
            } else {
                self.pushResult(["denied": true])
            }
        }
    }

    // risposta alla pagina: window.__unmemberPush({...})
    func pushResult(_ result: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            self.web?.evaluateJavaScript("window.__unmemberPush && window.__unmemberPush(\(json))", completionHandler: nil)
        }
    }
}
