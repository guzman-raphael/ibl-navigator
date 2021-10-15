import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import { FormControl, FormGroup, FormArray } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';
import { MatPaginator} from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { AllMiceService } from './all-mice.service';
import { FilterStoreService } from '../filter-store.service';
import * as moment from 'moment';
import * as _ from 'lodash';

@Component({
  selector: 'app-mouse-list',
  templateUrl: './mouse-list.component.html',
  styleUrls: ['./mouse-list.component.css']
})
export class MouseListComponent implements OnInit, OnDestroy {
  mouse_filter_form = new FormGroup({
    lab_name_control: new FormControl(),
    subject_nickname_control : new FormControl(),
    subject_uuid_control : new FormControl(),
    sex_control: new FormArray([new FormControl(), new FormControl(), new FormControl()]),
    subject_birth_date_control : new FormControl(),
    subject_line_control : new FormControl(),
    responsible_user_control : new FormControl(),
    projects_control: new FormControl()
  });
  loading = true;
  filterExpanded;
  mice;
  allMice;
  miceBirthdayFilter: Function;
  mice_menu: any;
  // setup for the table columns
  displayedColumns: string[] = ['lab_name', 'subject_nickname', 'subject_birth_date',
    'projects', 'subject_line', 'responsible_user', 'sex', 'spinning_brain', 'subject_uuid'];
  hideDeadMice = false;
  hideNotReady4Delay = false;
  onlyShowMiceWithSpinningBrain = false;

  // setup for the paginator
  dataSource;
  pageSize = 25;
  pageSizeOptions: number[] = [10, 25, 50, 100];

  filteredLabNameOptions: Observable<string[]>;
  filteredSubjectNicknameOptions: Observable<string[]>;
  filteredSubjectUuidOptions: Observable<string[]>;
  filteredSubjectLineOptions: Observable<string[]>;
  filteredResponsibleUserOptions: Observable<string[]>;
  filteredProjectsOptions: Observable<string[]>;
  genderMenu2ControlMap = { F: 0, M: 1, U: 2 };

  private miceSubscription: Subscription;
  private miceMenuSubscription: Subscription;
  private allMiceMenuSubscription: Subscription;

  constructor(public allMiceService: AllMiceService, public filterStoreService: FilterStoreService) { }

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  ngOnInit() {
    this.mice_menu = {};
    // this.loading = true;
    this.mice_menu['sex'] = { F: null, M: null, U: null };
    if (window.innerWidth < 1250 || window.innerHeight < 750) {
      this.filterExpanded = false;
    } else {
      this.filterExpanded = true;
    }
    const tableState: [number, number, Object] = this.filterStoreService.retrieveMouseTableState();
    const filters = this.filterStoreService.retrieveMouseFilter();
    for (const key in filters) {
      if (key === '__json') {
        const JSONcontent = JSON.parse(filters[key]);
        for (const item of JSONcontent) {
          if (typeof item === 'string') {
          } else {
            for (const gender of item) {
              this.mouse_filter_form.controls.sex_control['controls'][this.genderMenu2ControlMap[gender['sex']]].patchValue(true);
            }
          }
        }
      } else if (key === 'sex') {
        this.mouse_filter_form.controls.sex_control['controls'][this.genderMenu2ControlMap[filters[key]]].patchValue(true);
      } else if (key === 'subject_birth_date') {
        // console.log('before patching value for DOB - ', filters[key]);
        this.mouse_filter_form.controls.subject_birth_date_control.patchValue(moment.utc(filters[key]));
      } else {
        const controlName = key + '_control';
        if (this.mouse_filter_form.controls[controlName]) {
          const toPatch = {};
          toPatch[controlName] = filters[key];
          this.mouse_filter_form.patchValue(toPatch);
        }
      }
    }
    if (tableState[1]) {
      this.paginator.pageIndex = tableState[0];
      this.pageSize = tableState[1];
    }
    if (tableState[2] && Object.entries(tableState[2]).length > 0 && this.sort) {
      this.sort.active = Object.keys(tableState[2])[0];
      this.sort.direction = Object.values(tableState[2])[0].direction;
      // console.log(Object.keys(tableState[2])[0], ' => ',  Object.values(tableState[2])[0].direction);
    }

    this.applyFilter();
    // for creating the initial full menu
    this.allMiceService.getAllMiceMenu({'__order': 'lab_name'});
    this.allMiceMenuSubscription = this.allMiceService.getAllMiceMenuLoadedListener()
      .subscribe((mice: any) => {
        // console.log('retrieved mice for meu: ', mice);
        // this.loading = false;
        // this.mice = mice;
        this.allMice = mice;
        // this.dataSource = new MatTableDataSource(mice);
        // this.dataSource.sort = this.sort;
        // this.dataSource.paginator = this.paginator;
        this.createMenu(mice);
      });
  }

  ngOnDestroy() {
    if (this.miceSubscription) {
      this.miceSubscription.unsubscribe();
    }
    if (this.miceMenuSubscription) {
      this.miceMenuSubscription.unsubscribe();
    }

    // store checkbox filters upon leaving
    this.filterStoreService.hideDeadMice = this.hideDeadMice;
    this.filterStoreService.hideNotReady4DelayMice = this.hideNotReady4Delay;
    this.filterStoreService.onlyShowMiceWithSpinningBrain = this.onlyShowMiceWithSpinningBrain;
  }


  private createMenu(mice) {
    this.mice_menu = {};


    const keys = ['lab_name', 'subject_birth_date', 'subject_line', 'subject_uuid', 'sex',
    'subject_nickname', 'responsible_user', 'projects'];


    // initialize all entries into an empty list
    for (const key of keys) {
      if (key === 'sex') {
        this.mice_menu[key] = { F: false, M: false, U: false };
      } else {
        this.mice_menu[key] = [];
      }
    }


    // find unique entries for each key
    for (const mouse of mice) {
      for (const key of keys) {
        if (key !== 'sex' && key !== 'projects' && !this.mice_menu[key].includes(mouse[key])) {
          this.mice_menu[key].push(mouse[key]);
        } else if (key === 'sex') {
          if (Object.keys(this.mice_menu[key]).includes(mouse[key]) && !this.mice_menu[key][mouse[key]]) {
            this.mice_menu[key][mouse[key]] = true;
          }
        } else if (key === 'projects') {
          if (mouse[key].split(',').length === 1 && !this.mice_menu[key].includes(mouse[key])) {
            this.mice_menu[key].push(mouse[key]);
          } else if (mouse[key].split(',').length > 1) {
            for (const projOpt of mouse[key].split(',')) {
              if (!this.mice_menu[key].includes(projOpt)) {
                this.mice_menu[key].push(projOpt);
              }
            }
          }
        }
      }
    }

    // create formcontrol for item in menus
    // const sex_control_array = <FormArray>this.mouse_filter_form.controls['sex_control'];
    // sex_control_array.controls.length = 0;
    // for (const item of this.mice_menu['sex']) {
    //   sex_control_array.push(new FormControl(false));
    // }
    
    for (const item in this.mice_menu['sex']) {
      if (!this.mice_menu['sex'][item]) {
        this.mouse_filter_form.controls.sex_control['controls'][this.genderMenu2ControlMap[item]].patchValue(false);
        this.mouse_filter_form.controls.sex_control['controls'][this.genderMenu2ControlMap[item]].disable();
      } else {
        this.mouse_filter_form.controls.sex_control['controls'][this.genderMenu2ControlMap[item]].enable();
      }
    }

    // for autocomplete search bar
    // const autoCompleteList = ['lab_name', 'subject_nickname', 'subject_uuid', 'subject_line', 'responsible_user'];

    // for (const field of autoCompleteList) {
    //   const word = [];
    //   field.split('_').forEach((item) => {
    //     word.push(item.charAt(0).toUpperCase() + item.slice(1));
    //   });
    //   let filterName = 'filtered' + word.join('') + 'Options'; // filteredLabNameOptions
    //   console.log(filterName);
    //   this.`${filterName}` = this.mouse_filter_form.controls[field + '_control'].valueChanges
    //     .pipe(
    //       startWith(''),
    //       map(value => this._filter(value, field))
    //     );
    // }
    this.filteredLabNameOptions = this.mouse_filter_form.controls.lab_name_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'lab_name'))
      );

    this.filteredSubjectNicknameOptions = this.mouse_filter_form.controls.subject_nickname_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'subject_nickname'))
      );

    this.filteredSubjectUuidOptions = this.mouse_filter_form.controls.subject_uuid_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'subject_uuid'))
      );

    this.filteredSubjectLineOptions = this.mouse_filter_form.controls.subject_line_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'subject_line'))
      );

    this.filteredResponsibleUserOptions = this.mouse_filter_form.controls.responsible_user_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'responsible_user'))
      );

    this.filteredProjectsOptions = this.mouse_filter_form.controls.projects_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'projects'))
      );

    this.miceBirthdayFilter = (d: Date): boolean => {
      const birthDates = [];
      for (const date of this.mice_menu['subject_birth_date']) {
        birthDates.push(date);
      }
      return (d == null ? true : birthDates.includes(d.toISOString().split('T')[0]));
    };
  }

  private _filter(value: string, menuType: string): string[] {
    const filterValue = value.toLowerCase();
    const result = this.mice_menu[menuType].filter(menu_items => {
      if (menu_items && menu_items.toLowerCase().includes(filterValue)) {
        return true;
      }
    });
    return result;
  }

  applyFilter() {
    this.loading = true;

    // Check for the hide buttons in filter storage and apply
    this.hideDeadMice = this.filterStoreService.hideDeadMice;
    this.hideNotReady4Delay = this.filterStoreService.hideNotReady4DelayMice;
    this.onlyShowMiceWithSpinningBrain = this.filterStoreService.onlyShowMiceWithSpinningBrain;

    const request = this.filterRequests();
    if (Object.entries(request).length > 0) {
      this.filterStoreService.storeMouseFilter(request);
      this.allMiceService.retrieveMice(request);
      this.allMiceService.getRequestedMiceLoadedListener()
        .subscribe((mice: any) => {
          this.loading = false;
          this.mice = mice;
          this.updateTableView(); // making sure the hide button checkbox filters are included in this table view update
      });
    } else {
      this.resetFilter();
    }
  }

  updateMenu() {
    const menuRequest = this.filterRequests();
    if (Object.entries(menuRequest).length > 0) {
      this.allMiceService.getMiceMenu(menuRequest);
      this.allMiceService.getMiceMenuLoadedListener()
        .subscribe((mice: any) => {
          this.createMenu(mice);
        });
    }
  }

  stepBackMenu(event) {
    let focusOn: string;
    if (event.checked) {
      focusOn = 'sex';
    } else {
      focusOn = event.target.name;
    }
    const referenceMenuReq = this.filterRequests(focusOn);
    if (Object.entries(referenceMenuReq).length > 0) {
      this.allMiceService.getMiceMenu(referenceMenuReq);
      this.allMiceService.getMiceMenuLoadedListener()
        .subscribe((mice: any) => {
          this.createMenu(mice);
        });
    } else {
      this.createMenu(this.allMice);
    }

  }

  genderSelected(genderForm) {
    return genderForm.includes(true);
  }

  filterRequests(focusedField?: string) {
    const filterList = Object.entries(this.mouse_filter_form.getRawValue());
    const requestFilter = {};
    filterList.forEach((filter: Array<any>) => {
      // filter is [["lab_name_control", "somelab"], ["subject_nickname_control", null]...]
      const filterKey = filter[0].split('_control')[0]; // filter[0] is control name like 'lab_name_control'
      if (filter[1] && filterKey !== focusedField) {
        if (filterKey === 'sex' && this.genderSelected(filter[1])) {
          // only accepts single selection - this case the last selection. TODO:coordinate with API for multi-selection
          let requestedGender: string;
          const requestGenderArray = [];
          for (const index in filter[1]) {
            if (filter[1][index]) {
              requestedGender = Object.keys(this.mice_menu['sex'])[index];
              requestGenderArray.push(JSON.stringify({ 'sex': requestedGender }));
            }
          }
          requestFilter['__json'] = '[[' + requestGenderArray + ']]';
        } else if (filterKey !== 'sex') {
          // making sure gender filter gets removed from the request

          if (filterKey === 'subject_birth_date') {
            // Tue Dec 11 2018 00:00:00 GMT-0600 (Central Standard Time) => 2018-12-11T06:00:00.000Z => 2018-12-11
            const mouseDOB = moment.utc(filter[1]);
            requestFilter[filterKey] = mouseDOB.toISOString().split('T')[0];
          } else {
            requestFilter[filterKey] = filter[1];
          }
        }
      }
    });
    return requestFilter;
  }

  resetFilter() {
    this.loading = true;
    this.allMiceService.getAllMice();
    this.filterStoreService.clearMouseFilter();
    this.allMiceService.getMiceLoadedListener()
      .subscribe((mice: any) => {
        this.loading = false;
        this.mice = mice;
        this.allMice = mice;
        this.updateTableView(); // making sure the hide button checkbox filters are included in this table view update
      });
  }

  /**
   * called when user presses the rest button on the browser
   */
  clearFilter() {
    for (const control in this.mouse_filter_form.controls) {
      const toReset = {}

      if (control !== 'sex_control') {
        toReset[control] = '';
      } else {
        toReset[control] = [false, false, false];
        for (const index in this.mouse_filter_form.get(control)['controls']) {
          this.mouse_filter_form.get(control).get([index]).enable();
        }

      }
      this.mouse_filter_form.patchValue(toReset);
    }
    this.filterStoreService.clearMouseTableState();
    this.paginator.pageSize = 25;
    this.paginator.pageIndex = null;
    // the below sort is to reset the arrow UI that doesn't go away after this.sort.active = '' 
    this.sort.sortables.forEach(sortItem => {
      this.sort.sort(sortItem);
    });

    this.sort.active = '';
    this.filterStoreService.hideDeadMice = false;
    this.filterStoreService.hideNotReady4DelayMice = false;
    this.filterStoreService.onlyShowMiceWithSpinningBrain = false;
    this.applyFilter();
  }

  storeTableInfo(event) {
    let pageIndex;
    let pageSize;
    const sorter = {};
    if (event.pageSize) {
      pageIndex = event.pageIndex;
      pageSize = event.pageSize;
    }
    if (event.active && event.direction) {
      sorter[event.active] = { 'direction': event.direction };
    }
    this.filterStoreService.storeMouseTableState(pageIndex, pageSize, sorter);
  }

  /**
   * considers the hide button checkbox filters, then updates the table view according to the data source
   */
  updateTableView() {
    let criteria = []
    if (this.hideDeadMice) {
        criteria.push(_.map(this.mice, x => x.death_date === '0'));
    }
​
    if (this.hideNotReady4Delay) {
        criteria.push(_.map(this.mice, x => x.ready4delay > 0));
    }

    if (this.onlyShowMiceWithSpinningBrain) {
      criteria.push(_.map(this.mice, x => x.spinningbrain > 0))
    }

​    
    let selectedMice = this.mice;

​    if (criteria.length > 0) {
      let selection = _.map(_.zip(...criteria), (x) => _.every(x));
      selectedMice = _.filter(this.mice, (x, i) => selection[i]);
    }

    // update the table view here
    this.dataSource = new MatTableDataSource(selectedMice);
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (data, header) => data[header];
    this.dataSource.paginator = this.paginator;
  }
  ​
  /**
   * hide or show mice that are no longer alive
   */
  toggleMiceVitalStatus() {
    this.hideDeadMice = !this.hideDeadMice;
    this.updateTableView();
  }
  ​
  /**
   * hide or show mice that are don't yet have session with trainng status of "ready4delay"
   */
  toggleR4DviewStatus() {
    this.hideNotReady4Delay = !this.hideNotReady4Delay;
    this.updateTableView();
  }

  /**
   * hide or show mice that don't have the spinning brain 
   */
  toggleSpinningBrainViewStatus() {
    this.onlyShowMiceWithSpinningBrain = !this.onlyShowMiceWithSpinningBrain;
    this.updateTableView();
  }

}
