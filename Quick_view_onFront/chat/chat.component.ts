import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { environment as env, environment } from 'src/environments/environment';
import { FileUpload } from 'primeng/fileupload';
import { StoreService, ChatService, UserService } from 'src/app/Services/services';
import { saveAs } from 'file-saver';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})

export class ChatComponent implements OnInit {
  @ViewChild('file', {static:false}) file: FileUpload;

  FormSendMessage: FormGroup;
  error: any = 0;
  disabled_Send_msg: boolean = false;
  admin: boolean = true;
  isLoading: boolean = true;
  mon_id: any = 0;
  Users_Total: any = 0;
  ifConversation_messages: boolean = false;
  ListeMessages: any[] = [];
  selectedStructure: any = 0;
  list_users: any[] = []
  showBoxSend: boolean = false;
  conv_open: boolean = false;
  listStructures: any[] = [];
  Mes_conversation: any[] = [];
  id_disscussion: any = 0;
  Participant: any;
  image_participant: any;
  description_role: any;
  mail_user: any;
  id_client: any;
  DownloadFileMessageSB: Subscription;
  CreateMessageSB: Subscription;

  constructor(
    private storeService: StoreService,
    private UserService: UserService,
    private chatService: ChatService) {
    // initialisation
    this.Mes_conversation = this.storeService.get_DataSession('Mes_conversation') ? this.storeService.get_DataSession('Mes_conversation') : [];
    this.admin = this.storeService.IsAutorised(); // true si c'est un admin
    this.mon_id = this.storeService.get_DataSession('user_id');
    this.id_client = this.storeService.get_DataSession('id_client');

    this.FormSendMessage = new FormGroup({
      message: new FormControl('', [Validators.minLength(2), Validators.maxLength(100), Validators.required])
    });

    if (environment.if_socket_io) {
      // écoute sur la socket si des messages sont arrivés
      this.chatService.newMessageReceived().subscribe(data => {
        if (data.if_socket_up) { // si la socket est en marche
          if (this.id_disscussion == data.room) { // si le message reçue est dans la conversation actuelle
            let body =
            {
              id_discussion: Number(data.room),
              contenu_message: data.message,
              id_expediteur: data.user,
              date_creation: new Date().toISOString().slice(0, 23),
              readed: 0,
              type_message: data.type_message
            }
            this.ListeMessages.push(body);
            this.ifConversation_messages = true;
            setTimeout(() => {
              this.scroll();
            }, 300);
          }
        }
      }, err => { this.storeService.DisplayError("Erreur service du chat") });
    }
  }

  ngOnInit() {

    if (!this.admin) { // cas d'un utilisateur normale il discute avec des utlisateur suivant des structures
      this.selectedStructure = 0;
      this.listStructures[0] =
      {
        "label": "Listes des administrateurs",
        "value": 0
      };
      setTimeout(() => {
        this.GetStructureOfUtilisateur(); // récupération de la liste des structure de l'utilisateur normale connécté
      }, 50); // 50ms
    }
    else // si c'est un Administrateur Fonctionnel il peut discuter avec tout les utlisateurs 
    {
      this.AfficherUsersClient();
    }
  }

  /* ---- La fonction qui récpére toute la liste des utilisateur du client ---- */

  AfficherUsersClient() { // appleé seulement si c'est un Administrateur Fonctionnel il peut discuter avec tout les utlisateurs 

    this.list_users = [];
    let body = {
      field: "nom_user",
      order: "asc",
      skip: 0,
      take: 10000,
      id_client: this.storeService.get_DataSession("id_client")
    };

    this.UserService.AfficherUsersClient(body).subscribe(r => {
      if (r["codeError"] == 200) {
        if (r['data'].length > 0) { // si il y a des utilisateur pour ce client
          r['data'].forEach(element => {
            if (element.id != this.storeService.get_DataSession("user_id")) { // pour que l'utilisateur connecté ne figure pas sur la liste
              this.list_users.push(
                {
                  "id": element.id,
                  "nom_user": element.nom_user,
                  "prenom_user": element.prenom_user,
                  "avatar": element.image_user,
                  "mail_user": element.mail_user,
                  "telephone_user": element.telephone_user,
                  "description_role": element.role_description,
                  "id_role": element.id_role, // id ici sera soit 3 si c'est un admin fonctionnel soit "3" si c'est un utilisateur normale "5"
                  "id_structure": 0
                  // la structure == 0 car n'importe pas , c'est un admin Fonctionnel et il chat avec tout les utilisateur sans prendre en considération un structure
                }
              ); //fin push
            } // fin if
          }); // fin forEach
          this.isLoading = false;
        } // fin if r['data'].length > 0
      }
      else {
        this.storeService.DisplayError("Erreur du serveur");
        this.isLoading = false;
      }
    }, err => { this.isLoading = false; }
    ); // fin subscribe
  }

  /* ------------ Afficher la liste des structures de l'utilisateur normale ------------ */

  GetStructureOfUtilisateur() { // juste si c'est un utilisateur normale

    this.storeService.get_DataSession('structures_Of_Logged_User').forEach(e => {
      this.listStructures.push(
        {
          "label": e.info_structure.denomination_structure, // intitulé de la structure
          "value": e.id_structure // identifiant de la structure
        }
      )
    });
    this.GetListOfUsers(); // on affiche la liste des admins fonctionnels
  }

  /* -------------------------------------------------------------------------- */
  /*                  Récupération de la liste des utilisateurs                 */
  /* -------------------------------------------------------------------------- */

  GetListOfUsers() {

    this.list_users = [];
    this.ListeMessages = [];
    this.showBoxSend = false;
    this.conv_open = false;
    this.isLoading = true;
    let endPoint: any;
    let body: any;

    if (this.selectedStructure == 0) { // si l'utilisateur a clické sur la liste des admins
      endPoint = env.APIs.AfficherAdminClient;
      body = {
        skip: 0,
        take: 1000,
        id_client: this.storeService.get_DataSession('id_client'),
        field: "nom_user",
        order: "asc",
      };
    }

    else { // si l'utilisateur a clické sur une structure

      endPoint = env.APIs.loadUsersAffectedToStructure; // on récupére la liste des utilisateurs de la structure
      body = {
        id_user: this.storeService.get_DataSession('user_id'),
        id_structure: this.selectedStructure
      }
    }

    this.chatService.loadUsersAffectedToStructure(body, endPoint)
      .subscribe(res => {

        if (res['codeError'] == 200) {
          this.Users_Total = res['data'].length;
          if (res['data'].length > 0) // si il ya des utlisateurs
          {
            res['data'].forEach(element => {
              this.list_users.push(
                {
                  "id": element.id,
                  "nom_user": element.nom_user,
                  "prenom_user": element.prenom_user,
                  "avatar": element.avatar,
                  "mail_user": element.mail_user,
                  "telephone_user": element.telephone_user,
                  "description_role": element.description_role,
                  "id_role": (endPoint == env.APIs.AfficherAdminClient) ? element.id_role : element.id_statut_pour_structure,
                  "id_structure": this.selectedStructure
                })
            });
          }
        }
        else {
          this.storeService.DisplayError("Erreur du serveur");
        }
        this.isLoading = false;
      }, err => { this.isLoading = false; }
      ) // subscribe
  }

  /* -------------------------- la fonction du scroll ------------------------- */

  scroll() {
    var element = document.getElementById("end_messages");
    element.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
  }

  /* -------------------------------------------------------------------------- */
  /*                 La fonction de création d'une conversation                 */
  /* -------------------------------------------------------------------------- */

  Open_Conversation(participant_conversation) {

    // participant_conversation // objet du participant séléctionné 

    this.isLoading = true; // loader
    this.ListeMessages = []; // on vide la liste des messages
    this.id_disscussion = 0; // on rénitialise la conversation
    this.FormSendMessage.get('message').setValue(null);

    // Objet à envoyé à l'api

    let body = {
      "id_createur": this.storeService.get_DataSession('user_id'), // identifiant de l'utilisateur connécté
      "id_participant": participant_conversation.id, // identifiant du participant séléctionné
      "id_client": this.storeService.get_DataSession('id_client'),
      "id_structure": participant_conversation.id_structure
    }

    this.chatService.CreateConversation(body)
      .subscribe(res => {
        if (res["codeError"] == 200) {
          if (res["id"] && res["id"] != 0) {
            this.id_disscussion = Number(res["id"]); // récupération de l'identifiant de la discussion
            if (env.if_socket_io) // joindre le room si la socket est ok et si le room n'est pas déja join par l'utilisateur
            {
              this.chatService.joinRoom({ user: this.storeService.get_DataSession('user_id'), room: Number(res["id"]) });
            }
            this.ifConversation_messages = res['NbRows'] > 0 ? true : false;
            this.ListeMessages = res['NbRows'] > 0 ? res['data'] : [];
            this.description_role = participant_conversation.description_role;
            this.image_participant = participant_conversation.avatar;
            this.mail_user = participant_conversation.mail_user;
            this.Participant = participant_conversation.nom_user + " " + participant_conversation.prenom_user;
            this.conv_open = true;
            this.showBoxSend = true;
            this.isLoading = false;
            setTimeout(() => {
              this.scroll();
            }, 500);
          }
          else {
            this.storeService.DisplayError("Erreur du serveur ...");
            this.isLoading = false;
            this.conv_open = false;
          }
        }
        else // cas d'une erreur
        {
          this.conv_open = false;
          this.storeService.DisplayError("Erreur du serveur ...");
          this.isLoading = false;
        }
      }, err => { this.isLoading = false; });
  }

  /* -------------------------------------------------------------------------- */
  /*                            save data in DataBase                           */
  /* -------------------------------------------------------------------------- */

  EnvoyerMessage(file) {

    let if_file: any = (file.length > 0) ? true : false; // true si l'utilisateur à join un fichier
    var formData = new FormData(); // pour l'envoyé à l'api
    var body_message_sokcet: any;
    var body_message_liste: any;

    if (this.FormSendMessage.valid && this.id_disscussion != 0) // si le message n'est pas vide
    {
      formData.append('id_expediteur', this.mon_id);
      formData.append('id_client', this.id_client);
      formData.append('contenu_message', this.FormSendMessage.value.message);
      formData.append('id_discussion', this.id_disscussion);
      if (if_file) // si il y'a un fichier
      {
        formData.append('file', file[0]);
        formData.append('if_file', "1");
      }
      else // pas de fichier
      {
        formData.append('if_file', "0");
      }
      // objet pour envoyé le message via la socket et le pushé dans la liste des messages
      body_message_sokcet = {
        user: this.mon_id,
        room: this.id_disscussion,
        message: this.FormSendMessage.value.message,
        type_message: 0
      };
      // objet du message à pusher dans la liste
      body_message_liste =
      {
        id_discussion: this.id_disscussion,
        contenu_message: this.FormSendMessage.value.message,
        id_expediteur: this.mon_id,
        date_creation: new Date().toISOString().slice(0, 23),
        readed: 0,
        type_message: 0
      };
      this.Socket_sendMessage(body_message_sokcet, body_message_liste);// send on socket
      this.SubscribeMessage(formData, if_file); // sauvegarde du message dans la base de donnée
    }

    else // formulaire invalide
    {
      this.storeService.DisplayError("Veuillez saisir un message de 2 caractères au minimum");
    }
  }

  Socket_sendMessage(body_message_sokcet: any, body_message_liste: any) {
    if (this.chatService.sendMessage(body_message_sokcet) == false) {
      // push du message directement si la sockete est down
      this.ListeMessages.push(body_message_liste);
      setTimeout(() => {
        setTimeout(() => {
          this.ifConversation_messages = true;
        }, 100);
        this.scroll();
      }, 100);
    }
  }

  SubscribeMessage(formData, if_file) {
    this.disabled_Send_msg = true;
    this.CreateMessageSB = this.chatService.CreateMessage(formData).subscribe(r => {
      if (r['codeError'] == 200) {
        // si il y'a une piece jointe 
        if (if_file == 1) {
          // objet pour envoyé le message via la socket et le pushé dans la liste des messages
          let body_message_sokcet = {
            user: this.mon_id,
            room: this.id_disscussion,
            message: r['val'],
            type_message: 1
          };
          // objet du message à pusher dans la liste
          let body_message_liste =
          {
            id_discussion: this.id_disscussion,
            contenu_message: r['val'],
            id_expediteur: this.mon_id,
            mon_id: this.mon_id,
            date_creation: new Date().toISOString().slice(0, 23),
            readed: 0,
            type_message: 1
          };
          this.Socket_sendMessage(body_message_sokcet, body_message_liste);// send on socket
        }
        this.file.clear();
        this.FormSendMessage.get('message').setValue('');
        this.disabled_Send_msg = false;
        setTimeout(() => {
          this.scroll();
        }, 500);
      }
      else {
        this.storeService.DisplayError("Erreur du serveur")
      }
    }, err => { this.storeService.DisplayError("Erreur du serveur") });// fin subscribe

    setTimeout(() => {
      this.disabled_Send_msg = false;
    }, 2000);
  }

  DownloadFileMessage(contenu_message) {
    var body = {
      fileName: contenu_message,
      id_client: this.id_client
    }

    this.DownloadFileMessageSB = this.chatService.DownloadFileMessage(body)
      .subscribe(res => {
        if (res != null) {
          saveAs(res, contenu_message);
        }
        else {
          this.storeService.DisplayError("Erreur fichier non existant sur le serveur...");
        };
      }
      );// fin subscribe
  }

  ngOnDestroy() {

    let unsubscribeList = [
      this.DownloadFileMessageSB,
      this.CreateMessageSB
    ]

    unsubscribeList.forEach(element => {
      if (element) {
        element.unsubscribe();
      }
    });
  }

}